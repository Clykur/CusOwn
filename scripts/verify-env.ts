import { EXIT_ENV, MSG } from '../config/quality/local-quality.constants';
import { looksLikePlaceholderEnvValue } from '../config/env';

const REQUIRED = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SALON_TOKEN_SECRET',
  'CRON_SECRET',
] as const;

function verify(): void {
  const missing = REQUIRED.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    console.error(MSG.ENV_FAIL);
    console.error('Missing:', missing.join(', '));
    process.exit(EXIT_ENV);
  }

  if (process.env.NODE_ENV === 'production') {
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
  }
}

verify();
console.log('Environment validation passed.\n');
