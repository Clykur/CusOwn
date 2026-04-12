#!/usr/bin/env node
/**
 * Ensures package-lock.json exists and matches package.json root dependency specs.
 * Pure JSON (no npm registry) so `guard:all` never hangs on `npm ci --dry-run`.
 * CI can still run `npm ci` in the workflow for a full install check.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const lockPath = path.join(ROOT, 'package-lock.json');
const pkgPath = path.join(ROOT, 'package.json');

if (!fs.existsSync(lockPath)) {
  console.error('ERROR: package-lock.json is missing. Commit it for security and reproducibility.');
  process.exit(1);
}

let pkg;
let lock;
try {
  pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
} catch (e) {
  console.error('ERROR: Invalid package.json:', e instanceof Error ? e.message : e);
  process.exit(1);
}
try {
  lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
} catch (e) {
  console.error(
    'ERROR: Invalid package-lock.json (not valid JSON):',
    e instanceof Error ? e.message : e
  );
  process.exit(1);
}

if (!lock.lockfileVersion || lock.lockfileVersion < 2) {
  console.error('ERROR: package-lock.json must use lockfileVersion >= 2.');
  process.exit(1);
}

const root = lock.packages && lock.packages[''];
if (!root || typeof root !== 'object') {
  console.error('ERROR: package-lock.json is missing a valid packages[""] entry.');
  process.exit(1);
}

if (pkg.name && root.name && pkg.name !== root.name) {
  console.error('ERROR: package.json "name" does not match package-lock.json root name.');
  process.exit(1);
}

const want = {
  ...(pkg.dependencies || {}),
  ...(pkg.devDependencies || {}),
  ...(pkg.optionalDependencies || {}),
};

const lockedRoot = {
  ...(root.dependencies || {}),
  ...(root.devDependencies || {}),
};

function normSpec(v) {
  return String(v == null ? '' : v).trim();
}

const wantNames = new Set(Object.keys(want));
const lockedNames = new Set(Object.keys(lockedRoot));

for (const name of wantNames) {
  if (!lockedNames.has(name)) {
    console.error(
      `ERROR: "${name}" is listed in package.json but missing from package-lock.json root. Run npm install and commit package-lock.json.`
    );
    process.exit(1);
  }
  const a = normSpec(want[name]);
  const b = normSpec(lockedRoot[name]);
  if (a !== b) {
    console.error(
      `ERROR: Version spec for "${name}" differs between package.json and package-lock.json.\n  package.json: ${a}\n  lockfile:    ${b}\nRun npm install and commit package-lock.json.`
    );
    process.exit(1);
  }
}

for (const name of lockedNames) {
  if (!wantNames.has(name)) {
    console.error(
      `ERROR: "${name}" is in package-lock.json root but not in package.json. Run npm install and commit package-lock.json.`
    );
    process.exit(1);
  }
}

console.log('Lockfile verified.');
