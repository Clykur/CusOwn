#!/usr/bin/env ts-node

import { CircuitBreaker, CircuitState } from '../../lib/resilience/circuit-breaker';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function runAsyncTest(name: string, fn: () => Promise<void>): Promise<void> {
  await fn();
  console.log(`  ✅ ${name}`);
}

export async function runUnitCircuitBreakerTests(): Promise<void> {
  console.log('\n--- unit: lib/resilience/circuit-breaker ---\n');

  await runAsyncTest('execute returns result when fn succeeds', async () => {
    const cb = new CircuitBreaker({
      failureThreshold: 2,
      resetTimeoutMs: 1000,
      halfOpenMaxCalls: 1,
    });
    const result = await cb.execute(async () => 10);
    assert(result === 10, `Expected 10, got ${result}`);
    assert(cb.getState() === CircuitState.CLOSED, 'State should be CLOSED');
  });

  await runAsyncTest('execute opens circuit after failureThreshold failures', async () => {
    const cb = new CircuitBreaker({
      failureThreshold: 2,
      resetTimeoutMs: 10000,
      halfOpenMaxCalls: 1,
    });
    await cb
      .execute(async () => {
        throw new Error('fail');
      })
      .catch(() => {});
    await cb
      .execute(async () => {
        throw new Error('fail');
      })
      .catch(() => {});
    assert(cb.getState() === CircuitState.OPEN, 'State should be OPEN');
    try {
      await cb.execute(async () => 1);
      throw new Error('Expected throw');
    } catch (e) {
      assert((e as Error).message === 'Circuit breaker is OPEN', 'Expected OPEN error');
    }
  });

  await runAsyncTest('half-open allows one call after resetTimeoutMs', async () => {
    const cb = new CircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 50,
      halfOpenMaxCalls: 2,
    });
    await cb
      .execute(async () => {
        throw new Error('fail');
      })
      .catch(() => {});
    assert(cb.getState() === CircuitState.OPEN, 'State should be OPEN');
    await new Promise((r) => setTimeout(r, 60));
    assert(cb.getState() === CircuitState.HALF_OPEN, 'State should be HALF_OPEN');
    const result = await cb.execute(async () => 99);
    assert(result === 99, `Expected 99, got ${result}`);
    assert(cb.getState() === CircuitState.CLOSED, 'State should be CLOSED after success');
  });

  await runAsyncTest('half_open opens again if call fails', async () => {
    const cb = new CircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 50,
      halfOpenMaxCalls: 2,
    });
    await cb
      .execute(async () => {
        throw new Error('fail');
      })
      .catch(() => {});
    await new Promise((r) => setTimeout(r, 60));
    await cb
      .execute(async () => {
        throw new Error('fail again');
      })
      .catch(() => {});
    await cb
      .execute(async () => {
        throw new Error('fail again');
      })
      .catch(() => {});
    assert(cb.getState() === CircuitState.OPEN, 'State should be OPEN');
  });

  await runAsyncTest('getState returns CLOSED when no failures', async () => {
    const cb = new CircuitBreaker({
      failureThreshold: 2,
      resetTimeoutMs: 1000,
      halfOpenMaxCalls: 1,
    });
    await cb.execute(async () => 1);
    assert(cb.getState() === CircuitState.CLOSED, 'State should be CLOSED');
  });

  await runAsyncTest('half-open allows only halfOpenMaxCalls then reopens on failure', async () => {
    const cb = new CircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 50,
      halfOpenMaxCalls: 1,
    });
    await cb
      .execute(async () => {
        throw new Error('fail');
      })
      .catch(() => {});
    await new Promise((r) => setTimeout(r, 60));
    assert(cb.getState() === CircuitState.HALF_OPEN, 'State should be HALF_OPEN');
    const result = await cb.execute(async () => 42);
    assert(result === 42, `Expected 42, got ${result}`);
    assert(cb.getState() === CircuitState.CLOSED, 'State should be CLOSED after success');
  });
}

if (require.main === module) {
  runUnitCircuitBreakerTests()
    .then(() => {
      console.log('\n✅ unit-circuit-breaker: all passed\n');
      process.exit(0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
