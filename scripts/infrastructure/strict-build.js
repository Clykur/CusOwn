#!/usr/bin/env node
/**
 * Monorepo production build (turbo). Fails on build warnings in output.
 * Requires NEXT_PUBLIC_SUPABASE_* (CI step env or .env.test via build:strict wrapper).
 */
const { spawnSync } = require('child_process');
const path = require('path');

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';
const nodeCommand = process.platform === 'win32' ? 'node.exe' : 'node';
const ROOT = path.resolve(__dirname, '..', '..');

function cleanBuildArtifacts() {
  const cleanResult = spawnSync(nodeCommand, ['scripts/infrastructure/clean-build-artifacts.js'], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  if (cleanResult.status !== 0) {
    process.exit(cleanResult.status || 1);
  }
}

function runTurboBuild() {
  return spawnSync(npmCmd, ['exec', 'turbo', 'build'], {
    cwd: ROOT,
    env: { ...process.env, CI: process.env.CI || 'true' },
    encoding: 'utf8',
    shell: isWindows,
  });
}

function main() {
  cleanBuildArtifacts();
  const result = runTurboBuild();
  const combined = `${result.stdout || ''}${result.stderr || ''}`;
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  const code = result.status ?? 1;
  if (code !== 0) {
    process.exit(code);
  }

  const warningPatterns = [/\bcompiled with warnings\b/i, /\[webpack\].*warn/i];
  if (warningPatterns.some((pattern) => pattern.test(combined))) {
    // eslint-disable-next-line no-console
    console.error('Build warnings detected. Strict build mode fails on warnings.');
    process.exit(1);
  }
}

main();
