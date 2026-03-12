#!/usr/bin/env ts-node

import { pollWithRetry } from '../../lib/resilience/poll-with-retry';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function runAsyncTest(name: string, fn: () => Promise<void>): Promise<void> {
  await fn();
  console.log(`  ✅ ${name}`);
}

export async function runUnitPollWithRetryTests(): Promise<void> {
  console.log('\n--- unit: lib/resilience/poll-with-retry ---\n');

  await runAsyncTest('pollWithRetry stops when shouldStop returns true', async () => {
    let calls = 0;
    const handle = pollWithRetry({
      fn: async () => ++calls,
      intervalMs: 20,
      shouldStop: (n) => n >= 2,
    });
    await new Promise((r) => setTimeout(r, 100));
    handle.stop();
    assert(calls >= 2, `Expected at least 2 calls, got ${calls}`);
  });

  await runAsyncTest('pollWithRetry stop() prevents further ticks', async () => {
    let calls = 0;
    const handle = pollWithRetry({
      fn: async () => ++calls,
      intervalMs: 50,
    });
    handle.stop();
    await new Promise((r) => setTimeout(r, 120));
    assert(calls <= 1, `Expected at most 1 call after stop, got ${calls}`);
  });

  await runAsyncTest('pollWithRetry invokes onError when fn throws', async () => {
    let errorSeen: unknown = null;
    const handle = pollWithRetry({
      fn: async () => {
        throw new Error('poll error');
      },
      intervalMs: 30,
      onError: (e) => {
        errorSeen = e;
      },
    });
    await new Promise((r) => setTimeout(r, 80));
    handle.stop();
    assert(errorSeen !== null, 'Expected onError to be called');
    assert((errorSeen as Error).message === 'poll error', 'Expected same error message');
  });

  await runAsyncTest('pollWithRetry respects AbortSignal', async () => {
    const ac = new AbortController();
    let calls = 0;
    pollWithRetry({
      fn: async () => ++calls,
      intervalMs: 100,
      signal: ac.signal,
    });
    ac.abort();
    await new Promise((r) => setTimeout(r, 50));
    assert(calls <= 1, 'Expected at most 1 call after abort');
  });

  await runAsyncTest('pollWithRetry with already aborted signal does not start', async () => {
    const ac = new AbortController();
    ac.abort();
    let calls = 0;
    pollWithRetry({
      fn: async () => ++calls,
      intervalMs: 10,
      signal: ac.signal,
    });
    await new Promise((r) => setTimeout(r, 30));
    assert(calls === 0, 'Expected no calls when signal already aborted');
  });
}

if (require.main === module) {
  runUnitPollWithRetryTests()
    .then(() => {
      console.log('\n✅ unit-poll-with-retry: all passed\n');
      process.exit(0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
