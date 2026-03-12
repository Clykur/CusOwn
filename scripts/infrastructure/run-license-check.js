#!/usr/bin/env node
/**
 * License compliance: fail on GPL/AGPL and any license not in allowlist.
 * Uses .github/license-allowlist.txt. Override via env LICENSE_ALLOWLIST (comma-separated).
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const ALLOWLIST_FILE = path.join(ROOT, '.github', 'license-allowlist.txt');
const FORBIDDEN = ['GPL', 'AGPL', 'GPL-2.0', 'GPL-3.0', 'AGPL-1.0', 'AGPL-3.0'];

function loadAllowlist() {
  let allowed = process.env.LICENSE_ALLOWLIST
    ? process.env.LICENSE_ALLOWLIST.split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  if (allowed.length === 0 && fs.existsSync(ALLOWLIST_FILE)) {
    const content = fs.readFileSync(ALLOWLIST_FILE, 'utf8');
    allowed = content
      .split('\n')
      .map((line) => line.replace(/#.*$/, '').trim())
      .filter(Boolean);
  }
  if (allowed.length === 0) {
    allowed = ['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC'];
  }
  return new Set(allowed.map((s) => s.replace(/\*$/, '').toUpperCase()));
}

function normalizeLicense(lic) {
  if (!lic || lic === 'undefined') return 'UNKNOWN';
  return String(lic)
    .replace(/^["']|["']$/g, '')
    .replace(/\*$/, '')
    .toUpperCase();
}

function isForbidden(lic) {
  const n = normalizeLicense(lic);
  if (n.includes('LGPL')) return false;
  return FORBIDDEN.some((f) => n.includes(f));
}

function isAllowed(lic, allowlist) {
  const n = normalizeLicense(lic);
  if (allowlist.has(n)) return true;
  for (const a of allowlist) {
    if (n.startsWith(a) || n.includes(a)) return true;
  }
  return false;
}

function main() {
  const outPath = path.join(ROOT, 'licenses.json');
  try {
    const stdout = execSync('npx --yes license-checker --production --json', {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });
    fs.writeFileSync(outPath, stdout, 'utf8');
  } catch (e) {
    console.error('ERROR: license-checker failed. Install with: npm install -D license-checker');
    process.exit(1);
  }

  if (!fs.existsSync(outPath)) {
    console.error('ERROR: licenses.json was not generated.');
    process.exit(1);
  }

  const raw = fs.readFileSync(outPath, 'utf8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    console.error('ERROR: Invalid licenses.json.');
    process.exit(1);
  }

  const allowlist = loadAllowlist();
  const projectName = require(path.join(ROOT, 'package.json')).name || 'cusown';
  const disallowed = [];
  const forbidden = [];

  for (const [pkg, info] of Object.entries(data)) {
    if (pkg.startsWith(projectName + '@')) continue;
    const lic =
      info && info.licenses
        ? Array.isArray(info.licenses)
          ? info.licenses[0]
          : info.licenses
        : 'UNKNOWN';
    const licStr = typeof lic === 'string' ? lic : (lic && lic.name) || 'UNKNOWN';

    if (isForbidden(licStr)) {
      forbidden.push({ pkg, license: licStr });
    } else if (!isAllowed(licStr, allowlist)) {
      disallowed.push({ pkg, license: licStr });
    }
  }

  if (forbidden.length > 0) {
    console.error('ERROR: Forbidden licenses (GPL/AGPL) found:');
    forbidden.forEach(({ pkg, license }) => console.error(`  ${pkg}: ${license}`));
    process.exit(1);
  }

  if (disallowed.length > 0) {
    console.error('ERROR: Disallowed or unknown licenses (not in allowlist):');
    disallowed.forEach(({ pkg, license }) => console.error(`  ${pkg}: ${license}`));
    process.exit(1);
  }

  console.log('License check passed.');
}

main();
