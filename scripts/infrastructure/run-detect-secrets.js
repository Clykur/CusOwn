#!/usr/bin/env node
const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const MODE = process.argv.includes('--staged') ? 'staged' : 'repo';
const BASELINE = path.resolve(ROOT, '.secrets.baseline');

/**
 * Ensure baseline is UTF-8 and paths use forward slashes so the hook works on all platforms.
 * Stages the file if it was modified.
 */
function ensureBaselineEncodingAndPaths() {
  if (!fs.existsSync(BASELINE)) return;
  let raw = fs.readFileSync(BASELINE);
  let encoding = 'utf8';
  if (raw[0] === 0xff && raw[1] === 0xfe) {
    raw = raw.slice(2);
    encoding = 'utf16le';
  } else if (raw[0] === 0xfe && raw[1] === 0xff) {
    raw = raw.slice(2);
    encoding = 'utf16be';
  }
  const content = raw.toString(encoding || 'utf8');
  let baseline;
  try {
    baseline = JSON.parse(content);
  } catch {
    return;
  }
  const results = baseline.results;
  if (!results || typeof results !== 'object') return;
  let changed = false;
  const newResults = {};
  for (const [pathKey, findings] of Object.entries(results)) {
    const normalizedKey = pathKey.replace(/\\/g, '/');
    if (normalizedKey !== pathKey) changed = true;
    newResults[normalizedKey] = Array.isArray(findings)
      ? findings.map((f) => {
          if (f.filename && f.filename.includes('\\')) {
            changed = true;
            return { ...f, filename: f.filename.replace(/\\/g, '/') };
          }
          return f;
        })
      : findings;
  }
  if (encoding !== 'utf8' || changed) {
    baseline.results = newResults;
    fs.writeFileSync(BASELINE, JSON.stringify(baseline, null, 2), 'utf8');
    try {
      execSync('git add .secrets.baseline', { cwd: ROOT, stdio: 'pipe' });
    } catch {
      // Ignore if not a repo or add fails
    }
  }
}

function resolvePythonCommand() {
  const windowsCandidates = [
    path.join(ROOT, '.venv', 'Scripts', 'python.exe'),
    path.join(path.dirname(ROOT), '.venv', 'Scripts', 'python.exe'),
    process.env.VIRTUAL_ENV ? path.join(process.env.VIRTUAL_ENV, 'Scripts', 'python.exe') : null,
  ].filter(Boolean);

  const unixCandidates = [
    path.join(ROOT, '.venv', 'bin', 'python3'),
    path.join(path.dirname(ROOT), '.venv', 'bin', 'python3'),
    process.env.VIRTUAL_ENV ? path.join(process.env.VIRTUAL_ENV, 'bin', 'python3') : null,
  ].filter(Boolean);

  const candidates = [
    ...windowsCandidates.map((cmd) => ({ cmd, args: ['--version'] })),
    ...unixCandidates.map((cmd) => ({ cmd, args: ['--version'] })),
    { cmd: 'python3', args: ['--version'] },
    { cmd: 'python', args: ['--version'] },
    { cmd: 'py', args: ['-3', '--version'] },
  ];

  for (const candidate of candidates) {
    const check = spawnSync(candidate.cmd, candidate.args, {
      encoding: 'utf8',
    });
    if (check.status === 0) return candidate.cmd;
  }

  return null;
}

function getFileList() {
  const command =
    MODE === 'staged' ? 'git diff --cached --name-only --diff-filter=ACMR' : 'git ls-files';
  const output = execSync(command, { cwd: ROOT, encoding: 'utf8' }).trim();
  if (!output) return [];
  /** Known false positives: test fixtures, docs that reference env var names. */
  const SECRET_SCAN_SKIP_FILES = new Set([
    'scripts/unit-utils/unit-config-constants.test.ts',
    'scripts/unit-utils/unit-utils-url.test.ts',
    'docs/SECURITY_HARDENING_IMPLEMENTATION.md',
  ]);

  return output
    .split('\n')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .filter(
      (filePath) =>
        !filePath.startsWith('node_modules/') &&
        !filePath.startsWith('.next/') &&
        filePath !== '.secrets.baseline' &&
        filePath !== 'licenses.json' &&
        filePath !== 'audit.log' &&
        !SECRET_SCAN_SKIP_FILES.has(filePath)
    );
}

function main() {
  ensureBaselineEncodingAndPaths();

  const python = resolvePythonCommand();
  if (!python) {
    // eslint-disable-next-line no-console
    console.error(
      'Python 3 is required for detect-secrets. Install Python and run: pip install detect-secrets'
    );
    process.exit(1);
  }

  const files = getFileList();
  if (files.length === 0) {
    // eslint-disable-next-line no-console
    console.log('No files to scan for secrets.');
    return;
  }

  const args =
    python === 'py'
      ? ['-3', '-m', 'detect_secrets.pre_commit_hook', '--baseline', BASELINE, ...files]
      : ['-m', 'detect_secrets.pre_commit_hook', '--baseline', BASELINE, ...files];

  const run = spawnSync(python, args, { stdio: 'inherit', cwd: ROOT });
  if (run.status === 0) return;
  // Exit code 3: baseline was updated (line numbers refreshed). Stage it so the commit can include it.
  if (run.status === 3) {
    try {
      execSync('git add .secrets.baseline', { cwd: ROOT, stdio: 'pipe' });
      // eslint-disable-next-line no-console
      console.log('.secrets.baseline was updated and staged. Include it in your commit.');
    } catch {
      // Ignore if git add fails (e.g. not a repo).
    }
    process.exit(0);
  }
  process.exit(run.status || 1);
}

main();
