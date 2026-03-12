#!/usr/bin/env node
/**
 * Bundle size gate: fail if .next build exceeds configured thresholds.
 * Set BUNDLE_SIZE_LIMIT_KB in env or use default. Requires build output at .next.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
// Total .next JS+CSS; allow typical Next.js app (admin, analytics, booking). Override via BUNDLE_SIZE_LIMIT_KB.
const DEFAULT_LIMIT_KB = 1024 * 16; // 16MB
const limitKb = Number(process.env.BUNDLE_SIZE_LIMIT_KB) || DEFAULT_LIMIT_KB;

function getSizeKB(filePath) {
  try {
    const stat = fs.statSync(filePath);
    return stat.size / 1024;
  } catch {
    return 0;
  }
}

function main() {
  const nextDir = path.join(ROOT, '.next');
  if (!fs.existsSync(nextDir)) {
    console.warn('No .next directory; skipping bundle size check. Run build first.');
    return;
  }

  let total = 0;
  const sizes = [];

  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory() && e.name !== 'cache') {
        walk(full);
      } else if (e.isFile() && /\.(js|css)$/.test(e.name)) {
        const kb = getSizeKB(full);
        total += kb;
        sizes.push({ rel: path.relative(ROOT, full), kb });
      }
    }
  }

  walk(nextDir);
  const totalKb = Math.round(total * 10) / 10;

  if (totalKb > limitKb) {
    console.error(`ERROR: Bundle size ${totalKb} KB exceeds limit ${limitKb} KB.`);
    sizes.sort((a, b) => b.kb - a.kb);
    sizes.slice(0, 10).forEach(({ rel, kb }) => console.error(`  ${rel}: ${kb.toFixed(1)} KB`));
    process.exit(1);
  }

  console.log(`Bundle size OK: ${totalKb} KB (limit ${limitKb} KB).`);
}

main();
