#!/usr/bin/env node
/**
 * Ensures .env.test exists (for CI and guard:all). Idempotent if file already present.
 * Canonical content: env.test.example (repo root).
 */

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const envTestPath = path.join(root, '.env.test');
const examplePath = path.join(root, 'env.test.example');

if (fs.existsSync(envTestPath)) {
  process.exit(0);
}

if (fs.existsSync(examplePath)) {
  fs.copyFileSync(examplePath, envTestPath);
  console.log('Created .env.test from env.test.example');
  process.exit(0);
}

const placeholder = `NODE_ENV=test
CUSOWN_QUIET_INFRA_LOGS=true
NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key
SUPABASE_SERVICE_ROLE_KEY=placeholder-service-role-key
NEXT_PUBLIC_APP_URL=https://example.com
NEXT_PUBLIC_MARKETING_URL=https://example.com
SALON_TOKEN_SECRET=test-secret-for-ci-min-32-characters-long # pragma: allowlist secret
CRON_SECRET=test-cron-for-ci-min-16 # pragma: allowlist secret
REDIS_ENABLED=false
UPLOAD_STORAGE_BUCKET=uploads
`;
fs.writeFileSync(envTestPath, placeholder, 'utf8');
console.log('Created .env.test with placeholders.');
process.exit(0);
