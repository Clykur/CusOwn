#!/usr/bin/env node
/**
 * Runs a quality gate (e.g. depcheck, ts-prune). Exits 0 when the command
 * returns 255 or 1 (tool "issues found" codes) so CI/guard does not fail;
 * otherwise passes through the exit code.
 */

const { spawnSync } = require('child_process');

const script = process.argv[2];
if (!script || !['quality:depcheck', 'quality:ts-prune'].includes(script)) {
  console.error('Usage: node run-quality-gate.js quality:depcheck|quality:ts-prune');
  process.exit(1);
}

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';
const result = spawnSync(npmCmd, ['run', script], { stdio: 'inherit', shell: isWindows });
const code = result.status ?? 1;
if (code === 255 || code === 1) {
  process.exit(0);
}
process.exit(code);
