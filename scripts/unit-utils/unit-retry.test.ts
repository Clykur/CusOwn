#!/usr/bin/env ts-node

import { retry } from '../../lib/resilience/retry';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function runAsyncTest(name: string, fn: () => Promise<void>): Promise<void> {
  await fn();
  console.log(`  ✅ ${name}`);
}

export async function runUnitRetryTests(): Promise<void> {
  console.log('\n--- unit: lib/resilience/retry ---\n');

  await runAsyncTest('retry returns result on first success', async () => {
    const result = await retry(async () => 42);
    assert(result === 42, `Expected 42, got ${result}`);
  });

  await runAsyncTest('retry throws immediately when error is not retryable', async () => {
    let attempts = 0;
    try {
      await retry(async () => {
        attempts++;
        throw new Error('validation error');
      });
      throw new Error('Expected throw');
    } catch (e) {
      assert(attempts === 1, `Expected 1 attempt, got ${attempts}`);
      assert((e as Error).message === 'validation error', 'Expected same error');
    }
  });

  await runAsyncTest('retry eventually succeeds after retryable failures', async () => {
    let attempts = 0;
    const result = await retry(
      async () => {
        attempts++;
        if (attempts < 3) throw new Error('timeout');
        return 'ok';
      },
      { maxAttempts: 5, initialDelayMs: 10, maxDelayMs: 100 }
    );
    assert(result === 'ok', `Expected ok, got ${result}`);
    assert(attempts === 3, `Expected 3 attempts, got ${attempts}`);
  });

  await runAsyncTest('retry uses custom retryable predicate', async () => {
    let attempts = 0;
    try {
      await retry(
        async () => {
          attempts++;
          throw new Error('custom');
        },
        {
          maxAttempts: 3,
          initialDelayMs: 5,
          retryable: (e) => (e as Error).message === 'custom',
        }
      );
      throw new Error('Expected throw');
    } catch (e) {
      assert(attempts === 3, `Expected 3 attempts, got ${attempts}`);
    }
  });

  await runAsyncTest('retry caps maxAttempts at 10', async () => {
    let attempts = 0;
    try {
      await retry(
        async () => {
          attempts++;
          throw new Error('timeout');
        },
        { maxAttempts: 100, initialDelayMs: 1, maxDelayMs: 2 }
      );
    } catch {
      assert(attempts === 10, `Expected 10 attempts (cap), got ${attempts}`);
    }
  });

  await runAsyncTest('retry respects maxAttempts 1', async () => {
    let attempts = 0;
    try {
      await retry(
        async () => {
          attempts++;
          throw new Error('timeout');
        },
        { maxAttempts: 1, initialDelayMs: 1 }
      );
    } catch {
      assert(attempts === 1, `Expected 1 attempt, got ${attempts}`);
    }
  });

  await runAsyncTest('retry treats network and econnreset as retryable by default', async () => {
    let attempts = 0;
    const result = await retry(
      async () => {
        attempts++;
        if (attempts < 2) throw new Error('network error');
        return 'ok';
      },
      { maxAttempts: 3, initialDelayMs: 5, maxDelayMs: 20 }
    );
    assert(result === 'ok', `Expected ok, got ${result}`);
    assert(attempts === 2, `Expected 2 attempts, got ${attempts}`);
  });

  await runAsyncTest('retry treats econnreset as retryable', async () => {
    let attempts = 0;
    const result = await retry(
      async () => {
        attempts++;
        if (attempts < 2) throw new Error('econnreset');
        return 1;
      },
      { maxAttempts: 3, initialDelayMs: 5 }
    );
    assert(result === 1, `Expected 1, got ${result}`);
    assert(attempts === 2, `Expected 2 attempts, got ${attempts}`);
  });

  await runAsyncTest('retry throws last error after all attempts exhausted', async () => {
    const err = new Error('etimedout');
    try {
      await retry(
        async () => {
          throw err;
        },
        { maxAttempts: 2, initialDelayMs: 1, maxDelayMs: 2 }
      );
      throw new Error('Expected throw');
    } catch (e) {
      assert(e === err, 'Expected same error reference');
    }
  });

  await runAsyncTest('retry does not retry when retryable returns false', async () => {
    let attempts = 0;
    try {
      await retry(
        async () => {
          attempts++;
          throw new Error('etimedout');
        },
        { maxAttempts: 5, initialDelayMs: 1, retryable: () => false }
      );
      throw new Error('Expected throw');
    } catch (e) {
      assert(attempts === 1, `Expected 1 attempt, got ${attempts}`);
    }
  });
}

if (require.main === module) {
  runUnitRetryTests()
    .then(() => {
      console.log('\n✅ unit-retry: all passed\n');
      process.exit(0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
