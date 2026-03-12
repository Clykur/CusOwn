#!/usr/bin/env ts-node

import { checkHealth, checkMediaHealth } from '../../lib/monitoring/health';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function runAsyncTest(name: string, fn: () => Promise<void>): Promise<void> {
  await fn();
  console.log(`  ✅ ${name}`);
}

export async function runUnitHealthTests(): Promise<void> {
  console.log('\n--- unit: lib/monitoring/health ---\n');

  await runAsyncTest(
    'checkHealth returns status and checks with database and timestamp',
    async () => {
      const result = await checkHealth();
      assert(
        result.status === 'healthy' || result.status === 'unhealthy',
        'status must be healthy or unhealthy'
      );
      assert(
        result.checks.database === 'up' || result.checks.database === 'down',
        'checks.database'
      );
      assert(typeof result.checks.timestamp === 'string', 'checks.timestamp');
    }
  );

  await runAsyncTest('checkMediaHealth returns status and media checks', async () => {
    const result = await checkMediaHealth();
    assert(result.status === 'healthy' || result.status === 'unhealthy', 'status');
    assert(
      result.checks.media_storage === 'up' || result.checks.media_storage === 'down',
      'media_storage'
    );
    assert(
      result.checks.media_table === 'up' || result.checks.media_table === 'down',
      'media_table'
    );
    assert(typeof result.checks.timestamp === 'string', 'timestamp');
  });
}

if (require.main === module) {
  runUnitHealthTests()
    .then(() => {
      console.log('\n✅ unit-health: all passed\n');
      process.exit(0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
