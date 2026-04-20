#!/usr/bin/env node
/**
 * Runs husky only when useful: skip in CI, when disabled, or outside a git clone.
 * Cuts post-install time and avoids failures in Docker/archive installs.
 */
const { existsSync } = require('fs');
const { spawnSync } = require('child_process');
const path = require('path');

if (process.env.CI === 'true' || process.env.HUSKY === '0') {
  process.exit(0);
}

const root = path.resolve(__dirname, '../..');
if (!existsSync(path.join(root, '.git'))) {
  process.exit(0);
}

const huskyBin = path.join(root, 'node_modules', 'husky', 'bin.js');
if (!existsSync(huskyBin)) {
  process.exit(0);
}

const result = spawnSync(process.execPath, [huskyBin], {
  stdio: 'inherit',
  cwd: root,
  env: process.env,
});

process.exit(result.status === null ? 1 : result.status);
