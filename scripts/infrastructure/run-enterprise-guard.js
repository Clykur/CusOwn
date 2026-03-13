#!/usr/bin/env node
/**
 * Enterprise guard: runs all CI-equivalent checks locally.
 * Order: env setup, lockfile, lint, typecheck, security, unit tests (ts-node + vitest), quality gates, build.
 * If this passes, CI should pass.
 */
const { spawnSync } = require('child_process');
const path = require('path');

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';
const ROOT = process.cwd();

function run(label, cmd, args, opts = {}) {
  process.stdout.write(`\n=== ${label} ===\n`);

  const useShell = cmd === npmCmd;

  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    cwd: ROOT,
    shell: useShell,
    ...opts,
  });

  if (result.error) {
    process.stderr.write(`\nFAILED: ${label}\n`);
    process.stderr.write(`${result.error.message}\n`);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.stderr.write(`\nFAILED: ${label}\n`);
    process.exit(result.status || 1);
  }
}

// 1. Ensure .env.test so test:unit and vitest have env (CI creates it in workflow).
run('Ensure .env.test', process.execPath, [path.join(__dirname, 'ensure-env-test.js')]);

// 2. Lockfile (deterministic builds).
run('Lockfile check', process.execPath, [path.join(__dirname, 'check-lockfile.js')]);

// 3. Lint and typecheck.
run('Lint (strict)', npmCmd, ['run', 'lint:strict']);
run('Typecheck', npmCmd, ['run', 'typecheck']);

// 4. Security: secrets, custom rules, pre-push check, audit.
run('Secret scan', npmCmd, ['run', 'security:gitleaks']);
run('Security & quality (repo)', npmCmd, ['run', 'security:custom:repo']);
run('Security check (pre-push)', npmCmd, ['run', 'security-check']);
run('Dependency audit', npmCmd, ['run', 'security:audit']);
run('Dependency audit (deps)', npmCmd, ['run', 'security:deps']);

// 5. Unit tests: ts-node suites (same as CI).
run('Unit tests (ts-node)', npmCmd, ['run', 'test:unit'], {
  env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=2048' },
});

// 6. Vitest unit tests (same config as CI: unit-only, no e2e/integration).
run('Vitest unit tests', npmCmd, ['run', 'test:unit:vitest'], {
  env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=2048' },
});

// 7. Quality gates (wrapper normalizes exit 255 so guard passes when only findings).
run('Quality: depcheck', process.execPath, [
  path.join(__dirname, 'run-quality-gate.js'),
  'quality:depcheck',
]);
run('Quality: ts-prune', process.execPath, [
  path.join(__dirname, 'run-quality-gate.js'),
  'quality:ts-prune',
]);

// 8. Build (strict).
run('Build (strict)', npmCmd, ['run', 'build:strict']);

process.stdout.write('\nEnterprise guard passed.\n');
