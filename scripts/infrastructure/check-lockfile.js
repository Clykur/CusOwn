#!/usr/bin/env node
/**
 * Ensures package-lock.json exists and npm ci runs without resolution changes.
 * Fails if lockfile is missing or out of sync (deterministic builds).
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const lockPath = path.join(ROOT, 'package-lock.json');

if (!fs.existsSync(lockPath)) {
  console.error('ERROR: package-lock.json is missing. Commit it for security and reproducibility.');
  process.exit(1);
}

try {
  execSync('npm ci --dry-run', {
    cwd: ROOT,
    stdio: 'pipe',
    encoding: 'utf8',
  });
} catch (e) {
  const out = (e.stdout || '') + (e.stderr || '');
  if (/ERESOLVE|conflict|invalid/i.test(out)) {
    console.error(
      'ERROR: Lockfile is out of sync with package.json. Run npm install and commit package-lock.json.'
    );
    process.exit(1);
  }
  throw e;
}
console.log('Lockfile verified.');
