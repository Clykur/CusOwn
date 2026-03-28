#!/usr/bin/env node
/**
 * Ensures .env.test exists with placeholder Supabase vars (for CI and guard:all).
 * Idempotent: does nothing if .env.test already exists.
 */

const fs = require('fs');
const path = require('path');

const envTestPath = path.join(process.cwd(), '.env.test');
if (fs.existsSync(envTestPath)) return;

const placeholder = `# Auto-generated for CI/guard. Replace with real values for local e2e/integration.
NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key
SUPABASE_SERVICE_ROLE_KEY=placeholder-service-role-key
SALON_TOKEN_SECRET=test-secret-for-ci
CRON_SECRET=test-cron-for-ci
`;
fs.writeFileSync(envTestPath, placeholder, 'utf8');
console.log('Created .env.test with placeholders.');
process.exit(0);
