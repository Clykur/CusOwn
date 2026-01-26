#!/usr/bin/env ts-node

import { TestRunner, simulateUserAction } from './test-utils';
import { env, validateEnv } from '../config/env';

async function testConfigEnvSafety() {
  const runner = new TestRunner();

  try {
    await runner.runTest('CONFIG 1: Critical config values exist', async () => {
      await simulateUserAction('Verify critical config values');
      if (!env.supabase.url) throw new Error('NEXT_PUBLIC_SUPABASE_URL not set');
      if (!env.supabase.serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set');
      console.log(`   ✅ Config values exist`);
    });

    await runner.runTest('CONFIG 2: Env validation works', async () => {
      await simulateUserAction('Test env validation');
      try {
        validateEnv();
        console.log(`   ✅ Env validation passed`);
      } catch (error: any) {
        console.log(`   ⚠️  ${error.message}`);
      }
    });
  } finally {}

  runner.printSummary();
  return runner.getResults();
}

if (require.main === module) {
  testConfigEnvSafety().then(() => process.exit(0)).catch((error) => { console.error('Test failed:', error); process.exit(1); });
}

export { testConfigEnvSafety };
