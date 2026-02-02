#!/usr/bin/env ts-node
/**
 * Unit tests: config/env
 * validateEnv success and throw paths (coverage).
 */

import { validateEnv, env } from '../config/env';

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
    assert(typeof env.security.salonTokenSecret === 'string', 'security.salonTokenSecret');
  });

  runTest('should_validateEnv_throw_or_pass_based_on_env', () => {
    try {
      validateEnv();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      assert(message.includes('Missing'), `Expected Missing env message, got ${message}`);
    }
  });

  runTest('should_salonTokenSecret_use_CRON_SECRET_when_SALON_TOKEN_SECRET_unset', () => {
    const prevSalon = process.env.SALON_TOKEN_SECRET;
    const prevCron = process.env.CRON_SECRET;
    try {
      process.env.SALON_TOKEN_SECRET = '';
      process.env.CRON_SECRET = 'cron-fallback-secret';
      assert(
        env.security.salonTokenSecret === 'cron-fallback-secret',
        `Expected CRON_SECRET fallback, got ${env.security.salonTokenSecret}`
      );
    } finally {
      process.env.SALON_TOKEN_SECRET = prevSalon;
      process.env.CRON_SECRET = prevCron;
    }
  });

  runTest('should_salonTokenSecret_use_default_when_both_unset', () => {
    const prevSalon = process.env.SALON_TOKEN_SECRET;
    const prevCron = process.env.CRON_SECRET;
    try {
      process.env.SALON_TOKEN_SECRET = '';
      process.env.CRON_SECRET = '';
      assert(
        env.security.salonTokenSecret === 'default-secret-change-in-production',
        `Expected default, got ${env.security.salonTokenSecret}`
      );
    } finally {
      process.env.SALON_TOKEN_SECRET = prevSalon;
      process.env.CRON_SECRET = prevCron;
    }
  });
}

if (require.main === module) {
  runUnitConfigEnvTests();
  console.log('\n✅ unit-config-env: all passed\n');
}
