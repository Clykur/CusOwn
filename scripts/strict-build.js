#!/usr/bin/env node
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const nodeCommand = process.platform === 'win32' ? 'node.exe' : 'node';
const rootDir = process.cwd();
const strictDistDir = '.next-build';
const nextServerDir = path.join(rootDir, strictDistDir, 'server');
const manifestPlaceholders = [
  'pages-manifest.json',
  'app-paths-manifest.json',
  'next-font-manifest.json',
];

function ensureManifestPlaceholders() {
  fs.mkdirSync(nextServerDir, { recursive: true });
  for (const manifestName of manifestPlaceholders) {
    const target = path.join(nextServerDir, manifestName);
    try {
      fs.writeFileSync(target, '{}', { flag: 'wx' });
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
    }
  }
}

function runNextBuild() {
  ensureManifestPlaceholders();
  const result = spawnSync(command, ['next', 'build'], {
    env: { ...process.env, NEXT_DIST_DIR: strictDistDir },
    stdio: ['inherit', 'pipe', 'pipe'],
    encoding: 'utf8',
  });
  const stdout = result.stdout || '';
  const stderr = result.stderr || '';
  process.stdout.write(stdout);
  process.stderr.write(stderr);
  return { result, combined: `${stdout}\n${stderr}` };
}

function shouldRetryOnEnoent(combined) {
  return /ENOENT: no such file or directory/i.test(combined) && /\.next(-build)?\//i.test(combined);
}

let attempts = 0;
let build = runNextBuild();
let { result, combined } = build;

while (result.status !== 0 && shouldRetryOnEnoent(combined) && attempts < 2) {
  attempts += 1;
  // eslint-disable-next-line no-console
  console.warn(
    `Build failed with .next ENOENT. Cleaning artifacts and retrying (${attempts}/2)...`
  );
  spawnSync(nodeCommand, ['scripts/clean-build-artifacts.js'], { stdio: 'inherit' });
  ensureManifestPlaceholders();
  build = runNextBuild();
  result = build.result;
  combined = build.combined;
}

if (result.status !== 0) process.exit(result.status || 1);

const warningPatterns = [
  /\bcompiled with warnings\b/i,
  /\bwarning\b/i,
  /\[webpack\].*warn/i,
  /\s⚠\s/i,
];

const hasWarnings = warningPatterns.some((pattern) => pattern.test(combined));
if (hasWarnings) {
  // eslint-disable-next-line no-console
  console.error('Build warnings detected. Strict build mode fails on warnings.');
  process.exit(1);
}
