#!/usr/bin/env ts-node
/**
 * Unit tests: config/env
 * validateEnv and salon token shape (coverage).
 */

import { validateEnv, env } from '../../config/env';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function runTest(name: string, fn: () => void): void {
  fn();
  console.log(`  ✅ ${name}`);
}

export function runUnitConfigEnvTests(): void {
  console.log('\n--- unit: config/env ---\n');

  runTest('should_env_export_supabase_app_security', () => {
    assert(typeof env.supabase.url === 'string', 'supabase.url');
    assert(typeof env.app.baseUrl === 'string', 'app.baseUrl');
    assert(
      typeof env.security.salonTokenSecret === 'string' && env.security.salonTokenSecret.length > 0, // pragma: allowlist secret
      'security.salonTokenSecret (SALON_TOKEN_SECRET or non-prod fallback)'
    );
  });

  runTest('should_validateEnv_complete_in_non_production', () => {
    validateEnv();
  });
}

if (require.main === module) {
  runUnitConfigEnvTests();
  console.log('\n✅ unit-config-env: all passed\n');
}
