import { EXIT_ENV, MSG } from '../config/quality/local-quality.constants';

const REQUIRED = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

function verify(): void {
  const missing = REQUIRED.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    console.error(MSG.ENV_FAIL);
    console.error('Missing:', missing.join(', '));
    process.exit(EXIT_ENV);
  }
}

verify();
console.log('Environment validation passed.\n');
