#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const MODE = process.argv.includes('--staged') ? 'staged' : 'repo';
const WRITE_BASELINE = process.argv.includes('--write-baseline');
const ROOT = process.cwd();
const BASELINE_PATH = path.join(ROOT, '.security-quality-baseline.json');

const TEXT_EXTENSIONS = new Set([
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.mjs',
  '.cjs',
  '.json',
  '.md',
  '.yml',
  '.yaml',
  '.env',
  '.ini',
  '.toml',
]);

const IGNORE_PREFIXES = [
  'node_modules/',
  '.next/',
  '.git/',
  'coverage/',
  'dist/',
  'out/',
  '.turbo/',
];

const ENFORCED_PATH_PREFIXES = ['app/', 'components/', 'lib/', 'services/', 'config/'];
const ENFORCED_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']);

const ALLOWED_PROCESS_ENV_FILES = new Set([
  'config/env.ts',
  'next.config.js',
  'scripts/check-node-version.js',
  'lib/security/security-headers.ts',
  'lib/utils/url.ts',
]);

const ALLOWED_URL_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  'example.com',
  'example.org',
  'nextjs.org',
  'vercel.live',
  'api.razorpay.com',
  'accounts.google.com',
  'va.vercel-scripts.com',
  '*.supabase.co',
  'api.bigdatacloud.net', // Geo: BigDataCloud API (config/constants.ts)
  'www.bigdatacloud.com', // Geo: BigDataCloud docs (lib/geo comment)
  'www.w3.org', // W3C SVG namespace in data URIs (config/constants.ts DEFAULT_AVATAR_DATA_URI)
]);

const RULES = [
  { name: 'todo-fixme', regex: /\b(TODO|FIXME|XXX)\b/, message: 'TODO/FIXME/XXX is not allowed' },
  { name: 'debugger', regex: /\bdebugger\s*;?/, message: 'debugger statement is not allowed' },
  {
    name: 'console-log',
    regex: /\bconsole\.(log|debug|trace)\s*\(/,
    message: 'console.log/debug/trace is not allowed',
  },
  {
    name: 'hardcoded-api-key',
    regex: /\b(api[_-]?key|secret|access[_-]?token)\b\s*[:=]\s*['"`][A-Za-z0-9_\-]{16,}['"`]/i,
    message: 'Potential hardcoded key/secret/token detected',
  },
  {
    name: 'hardcoded-jwt',
    regex: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
    message: 'Potential hardcoded JWT token detected',
  },
  {
    name: 'aws-access-key',
    regex: /\bAKIA[0-9A-Z]{16}\b/,
    message: 'Potential AWS access key detected',
  },
  {
    name: 'private-key-block',
    regex: /-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----/,
    message: 'Private key block detected',
  },
];

function readGitFileFromIndex(filePath) {
  try {
    return execSync(`git show :${JSON.stringify(filePath)}`, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch {
    return null;
  }
}

function listFiles() {
  const command =
    MODE === 'staged' ? 'git diff --cached --name-only --diff-filter=ACMR' : 'git ls-files';
  const output = execSync(command, { cwd: ROOT, encoding: 'utf8' }).trim();
  if (!output) return [];
  return output
    .split('\n')
    .map((v) => v.trim())
    .filter(Boolean)
    .filter((filePath) => !IGNORE_PREFIXES.some((prefix) => filePath.startsWith(prefix)));
}

function shouldScan(filePath) {
  if (filePath.endsWith('.archived.tsx') || filePath.endsWith('.archived.ts')) return false;
  if (filePath.endsWith('.min.js')) return false;
  if (filePath.includes('/vendor/') || filePath.includes('/generated/')) return false;
  const ext = path.extname(filePath);
  if (TEXT_EXTENSIONS.has(ext)) return true;
  if (path.basename(filePath).startsWith('.env')) return true;
  return false;
}

function isEnforcedSourceFile(filePath) {
  if (!ENFORCED_PATH_PREFIXES.some((prefix) => filePath.startsWith(prefix))) return false;
  const ext = path.extname(filePath);
  return ENFORCED_EXTENSIONS.has(ext);
}

function getFileContent(filePath) {
  if (MODE === 'staged') {
    const staged = readGitFileFromIndex(filePath);
    if (staged != null) return staged;
  }
  const abs = path.resolve(ROOT, filePath);
  try {
    return fs.readFileSync(abs, 'utf8');
  } catch {
    return null;
  }
}

function validateHardcodedUrls(filePath, line, lineNumber, failures) {
  if (!isEnforcedSourceFile(filePath)) return;
  const matches = line.match(/https?:\/\/[^\s'"`)\]}]+/g);
  if (!matches) return;

  for (const rawUrl of matches) {
    if (rawUrl.includes('*')) continue;
    if (rawUrl.includes('${')) continue;
    try {
      const parsed = new URL(rawUrl);
      const host = parsed.hostname.toLowerCase();
      if (ALLOWED_URL_HOSTS.has(host)) continue;
      failures.push({
        filePath,
        lineNumber,
        message: `Hardcoded URL is not allowed in source: ${rawUrl}`,
      });
    } catch {
      failures.push({
        filePath,
        lineNumber,
        message: `Malformed hardcoded URL detected: ${rawUrl}`,
      });
    }
  }
}

function validateProcessEnvUsage(filePath, line, lineNumber, failures) {
  if (!line.includes('process.env')) return;
  if (ALLOWED_PROCESS_ENV_FILES.has(filePath)) return;
  if (!isEnforcedSourceFile(filePath)) return;
  failures.push({
    filePath,
    lineNumber,
    message: 'process.env usage is not allowed outside config/env.ts and approved config files',
  });
}

function scanFile(filePath, content, failures) {
  if (!isEnforcedSourceFile(filePath)) return;
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const lineNumber = i + 1;
    const previousLine = i > 0 ? lines[i - 1] : '';
    const twoLinesBack = i > 1 ? lines[i - 2] : '';

    for (const rule of RULES) {
      if (!rule.regex.test(line)) continue;

      // Allow explicit dev-only logs (still removed from production by Next compiler config).
      if (
        rule.name === 'console-log' &&
        (line.includes('dev-only-log') ||
          previousLine.includes('dev-only-log') ||
          twoLinesBack.includes('dev-only-log'))
      ) {
        continue;
      }

      failures.push({
        filePath,
        lineNumber,
        message: rule.message,
      });
    }

    validateHardcodedUrls(filePath, line, lineNumber, failures);
    validateProcessEnvUsage(filePath, line, lineNumber, failures);
  }
}

function normalizeFailures(failures) {
  const unique = new Map();
  for (const failure of failures) {
    const key = `${failure.filePath}:${failure.lineNumber}:${failure.message}`;
    if (!unique.has(key)) unique.set(key, failure);
  }
  return Array.from(unique.values()).sort((a, b) => {
    if (a.filePath !== b.filePath) return a.filePath.localeCompare(b.filePath);
    if (a.lineNumber !== b.lineNumber) return a.lineNumber - b.lineNumber;
    return a.message.localeCompare(b.message);
  });
}

function loadBaseline() {
  if (!fs.existsSync(BASELINE_PATH)) return new Set();
  const raw = fs.readFileSync(BASELINE_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed.issues)) return new Set();
  return new Set(parsed.issues);
}

function writeBaseline(failures) {
  const payload = {
    generatedAt: new Date().toISOString(),
    mode: 'repo',
    issues: failures.map(
      (failure) => `${failure.filePath}:${failure.lineNumber}:${failure.message}`
    ),
  };
  fs.writeFileSync(BASELINE_PATH, JSON.stringify(payload, null, 2));
}

function main() {
  const files = listFiles().filter(shouldScan);
  const failures = [];

  for (const filePath of files) {
    const content = getFileContent(filePath);
    if (content == null || content.trim() === '') continue;
    scanFile(filePath, content, failures);
  }

  const normalizedFailures = normalizeFailures(failures);

  if (WRITE_BASELINE) {
    writeBaseline(normalizedFailures);
    // eslint-disable-next-line no-console
    console.log(`Baseline written with ${normalizedFailures.length} issue(s): ${BASELINE_PATH}`);
    return;
  }

  const baseline = loadBaseline();
  const newFailures = normalizedFailures.filter(
    (failure) => !baseline.has(`${failure.filePath}:${failure.lineNumber}:${failure.message}`)
  );

  if (newFailures.length > 0) {
    // eslint-disable-next-line no-console
    console.error(`Validation failed (${MODE}) with ${newFailures.length} new issue(s):`);
    for (const failure of newFailures) {
      // eslint-disable-next-line no-console
      console.error(`- ${failure.filePath}:${failure.lineNumber} ${failure.message}`);
    }
    process.exit(1);
  }

  // eslint-disable-next-line no-console
  console.log(`Validation passed (${MODE}).`);
}

main();
