#!/usr/bin/env node
const { spawnSync } = require('child_process');

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';

const checks = [
  ['run', 'lint:strict'],
  ['run', 'typecheck'],
  ['run', 'security:gitleaks'],
  ['run', 'security:custom:repo'],
  ['run', 'security-check'],
  ['run', 'security:audit'],
  ['run', 'security:deps'],
  ['run', 'test:unit'],
  ['run', 'build:strict'],
];

for (const args of checks) {
  const label = `npm ${args.join(' ')}`;
  process.stdout.write(`\n=== ${label} ===\n`);
  const result = spawnSync(npmCmd, args, { stdio: 'inherit' });
  if (result.status !== 0) {
    process.stderr.write(`\nFAILED: ${label}\n`);
    process.exit(result.status || 1);
  }
}

process.stdout.write('\nEnterprise guard passed.\n');
