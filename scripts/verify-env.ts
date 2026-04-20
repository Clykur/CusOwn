import * as dotenv from 'dotenv';
import * as path from 'path';
import { EXIT_ENV, MSG } from '../config/quality/local-quality.constants';

/**
 * Keep aligned with config/env.ts PLACEHOLDER_MARKERS (production cannot use these).
 */
const PLACEHOLDER_MARKERS = [
  'placeholder',
  'your-project-id',
  'your-anon-key',
  'your-service-role',
  'your-cron-secret',
  'your-random-secret',
  'changeme',
] as const;

function looksLikePlaceholderEnvValue(value: string): boolean {
  const v = value.toLowerCase();
  return PLACEHOLDER_MARKERS.some((marker) => v.includes(marker));
}

const REQUIRED = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SALON_TOKEN_SECRET',
  'CRON_SECRET',
] as const;

const root = path.resolve(__dirname, '..');
// Same merge order as scripts/test-utils.ts and other tooling
dotenv.config({ path: path.join(root, '.env.test') });
dotenv.config({ path: path.join(root, '.env.local') });

const isProduction = process.env.NODE_ENV === 'production';

/**
 * In development/test, config/env.ts supplies Zod fallbacks for unset vars.
 * Only production deployments must provide real secrets in the environment.
 */
if (!isProduction) {
  console.log(
    'Environment validation passed (development).\n' +
      'Loaded .env.test and .env.local when present; unset keys use dev fallbacks from config/env.ts.\n'
  );
  process.exit(0);
}

const missing = REQUIRED.filter((key) => !process.env[key]?.trim());
if (missing.length > 0) {
  console.error(MSG.ENV_FAIL);
  console.error('Missing:', missing.join(', '));
  process.exit(EXIT_ENV);
}

for (const key of REQUIRED) {
  const v = process.env[key]!.trim();
  if (looksLikePlaceholderEnvValue(v)) {
    console.error(MSG.ENV_FAIL);
    console.error(
      `Invalid placeholder or template value for ${key} (production must use real credentials).`
    );
    process.exit(EXIT_ENV);
  }
}

console.log('Environment validation passed.\n');
