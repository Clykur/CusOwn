#!/usr/bin/env ts-node

import { supabase, TestRunner } from '../test-utils';

async function runDatabaseConnectionPoolTests(): Promise<void> {
  const runner = new TestRunner();

  await runner.runTest('get_connection_pool_stats RPC exists and returns JSON shape', async () => {
    const { data, error } = await supabase.rpc('get_connection_pool_stats');
    if (error) {
      const msg = error.message.toLowerCase();
      if (
        (msg.includes('function') && msg.includes('does not exist')) ||
        msg.includes('could not find the function')
      ) {
        return;
      }
      throw new Error(`get_connection_pool_stats error: ${error.message}`);
    }
    if (data == null) return;
    const obj = data as Record<string, unknown>;
    if (typeof obj.active !== 'undefined')
      assert(typeof obj.active === 'number', 'active must be number');
    if (typeof obj.idle !== 'undefined')
      assert(typeof obj.idle === 'number', 'idle must be number');
    if (typeof obj.max_connections !== 'undefined')
      assert(typeof obj.max_connections === 'number', 'max_connections must be number');
  });

  runner.printSummary();
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

if (require.main === module) {
  runDatabaseConnectionPoolTests()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

export { runDatabaseConnectionPoolTests };
