#!/usr/bin/env node
const { execSync, spawnSync } = require('child_process');
const path = require('path');

const ROOT = process.cwd();
const MODE = process.argv.includes('--staged') ? 'staged' : 'repo';
const BASELINE = path.resolve(ROOT, '.secrets.baseline');

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
  /** Test files with known false positives (template/URL literals flagged as high-entropy). */
  const SECRET_SCAN_SKIP_FILES = new Set([
    'scripts/unit-utils/unit-config-constants.test.ts',
    'scripts/unit-utils/unit-utils-url.test.ts',
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
  const python = resolvePythonCommand();
  if (!python) {
    // eslint-disable-next-line no-console
    console.error(
      'Python 3 is required for detect-secrets. Install Python and detect-secrets first.'
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
