#!/usr/bin/env ts-node
/**
 * Unit tests: lib/monitoring/request-context
 * withRequestContext, getCorrelationId. Uses Node AsyncLocalStorage.
 */

import { withRequestContext, getCorrelationId } from '../../lib/monitoring/request-context';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function runAsyncTest(name: string, fn: () => Promise<void>): Promise<void> {
  await fn();
  console.log(`  ✅ ${name}`);
}

export async function runUnitRequestContextTests(): Promise<void> {
  console.log('\n--- unit: lib/monitoring/request-context ---\n');

  runAsyncTest('getCorrelationId returns undefined when not in context', async () => {
    const id = getCorrelationId();
    assert(id === undefined, `Expected undefined outside context, got ${id}`);
  });

  runAsyncTest('withRequestContext runs handler and returns result', async () => {
    const req = new Request('http://localhost/', {
      headers: { 'x-correlation-id': 'test-correlation-123' },
    });
    const result = await withRequestContext(req, async (ctx) => {
      assert(ctx.correlationId === 'test-correlation-123', 'Expected passed correlation id');
      return 42;
    });
    assert(result === 42, `Expected 42, got ${result}`);
  });

  runAsyncTest('getCorrelationId returns id inside withRequestContext', async () => {
    const req = new Request('http://localhost/', {
      headers: { 'x-correlation-id': 'my-id' },
    });
    await withRequestContext(req, async () => {
      const id = getCorrelationId();
      assert(id === 'my-id', `Expected 'my-id', got '${id}'`);
    });
  });

  runAsyncTest('withRequestContext generates new UUID when no header', async () => {
    const req = new Request('http://localhost/');
    await withRequestContext(req, async (ctx) => {
      assert(typeof ctx.correlationId === 'string', 'Expected string');
      assert(ctx.correlationId.length > 0, 'Expected non-empty');
      assert(/^[0-9a-f-]+$/i.test(ctx.correlationId), 'Expected UUID-like format');
    });
  });

  runAsyncTest('getCorrelationId undefined after context exits', async () => {
    const req = new Request('http://localhost/', {
      headers: { 'x-correlation-id': 'out-of-scope' },
    });
    await withRequestContext(req, async () => {});
    const id = getCorrelationId();
    assert(id === undefined, `Expected undefined after exit, got ${id}`);
  });
}

if (require.main === module) {
  runUnitRequestContextTests()
    .then(() => {
      console.log('\n✅ unit-request-context: all passed\n');
      process.exit(0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
