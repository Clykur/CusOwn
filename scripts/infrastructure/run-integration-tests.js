#!/usr/bin/env node
/**
 * Runs scripts/integration/*.test.ts via ts-node (TestRunner style — not Vitest describe/it).
 * Skips when check-live-supabase-env fails (placeholder / missing URL), exit 0.
 */
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = process.cwd();
require('dotenv').config({ path: path.join(ROOT, '.env.test') });
require('dotenv').config({ path: path.join(ROOT, '.env.local') });

const checkLive = path.join(__dirname, 'check-live-supabase-env.js');
if (!fs.existsSync(checkLive)) {
  console.error('Missing check-live-supabase-env.js');
  process.exit(1);
}

const liveCheck = spawnSync(process.execPath, [checkLive], {
  cwd: ROOT,
  stdio: 'pipe',
});
if (liveCheck.status !== 0) {
  console.log(
    '\n⚠️  Skipping live DB integration scripts (no real Supabase in merged .env.test + .env.local).\n' +
      '   Vitest unit-database tests already ran. For RLS/migration tests, set real credentials in .env.local.\n'
  );
  process.exit(0);
}

const tsNodeBin = path.join(ROOT, 'node_modules', 'ts-node', 'dist', 'bin.js');
if (!fs.existsSync(tsNodeBin)) {
  console.error('ts-node not found. Run npm install.');
  process.exit(1);
}

const integrationFiles = [
  'scripts/integration/database-migrations.test.ts',
  'scripts/integration/database-indexes.test.ts',
  'scripts/integration/database-connection-pool.test.ts',
  'scripts/integration/atomic-booking-transactions.test.ts',
  'scripts/integration/integration-realtime-slot-updates.test.ts',
  'scripts/integration/slots-rls-policies.test.ts',
  'scripts/integration/bookings-rls-policies.test.ts',
];

for (const rel of integrationFiles) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) {
    console.error(`Missing integration file: ${rel}`);
    process.exit(1);
  }
  console.log(`\n=== ${rel} ===\n`);
  const result = spawnSync(
    process.execPath,
    [tsNodeBin, '-r', 'tsconfig-paths/register', '--project', 'scripts/tsconfig.json', rel],
    { cwd: ROOT, stdio: 'inherit', env: process.env }
  );
  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

console.log('\n✅ All integration (ts-node) suites passed.\n');
