#!/usr/bin/env node
/**
 * Pre-push security checks (mirrors CI security-scan job).
 * Run before pushing: npm run security-check
 * Ensures: package-lock.json exists, no dangerous code patterns in app/lib/components.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DANGEROUS_PATTERNS = [
  { pattern: /eval\s*\(/i, name: 'eval(' },
  { pattern: /Function\s*\(/i, name: 'Function(' },
  { pattern: /innerHTML\s*=/i, name: 'innerHTML =' },
  { pattern: /dangerouslySetInnerHTML/i, name: 'dangerouslySetInnerHTML' },
  { pattern: /document\.write/i, name: 'document.write' },
];

const DIRS = ['app', 'lib', 'components'];

function checkLockfile() {
  const lockPath = path.join(ROOT, 'package-lock.json');
  if (!fs.existsSync(lockPath)) {
    console.error(
      'ERROR: package-lock.json is missing. Commit it for security and reproducibility.'
    );
    return false;
  }
  console.log('OK package-lock.json present');
  return true;
}

function scanFile(filePath, content, relPath) {
  const hits = [];
  for (const { pattern, name } of DANGEROUS_PATTERNS) {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (pattern.test(lines[i])) {
        hits.push({ name, line: i + 1, relPath });
      }
    }
  }
  return hits;
}

function checkDangerousPatterns() {
  let found = 0;
  for (const dir of DIRS) {
    const absDir = path.join(ROOT, dir);
    if (!fs.existsSync(absDir)) continue;
    const walk = (d) => {
      const entries = fs.readdirSync(d, { withFileTypes: true });
      for (const e of entries) {
        const full = path.join(d, e.name);
        const rel = path.relative(ROOT, full);
        if (e.isDirectory()) {
          if (e.name !== 'node_modules' && e.name !== '.next' && e.name !== '.git') walk(full);
        } else if (/\.(tsx?|jsx?|mjs|cjs)$/.test(e.name)) {
          const content = fs.readFileSync(full, 'utf8');
          const hits = scanFile(full, content, rel);
          for (const h of hits) {
            console.error(`${rel}:${h.line} Dangerous pattern: ${h.name}`);
            found++;
          }
        }
      }
    };
    walk(absDir);
  }
  if (found > 0) {
    console.error('Fix or justify dangerous patterns before pushing.');
    return false;
  }
  console.log('OK no dangerous patterns in app/lib/components');
  return true;
}

function main() {
  console.log('Running pre-push security checks...\n');
  const lockOk = checkLockfile();
  const patternsOk = checkDangerousPatterns();
  if (!lockOk || !patternsOk) {
    process.exit(1);
  }
  console.log('\nAll security checks passed.');
}

main();
