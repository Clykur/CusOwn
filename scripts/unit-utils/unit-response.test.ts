#!/usr/bin/env ts-node

import { successResponse, errorResponse } from '../../lib/utils/response';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function runAsyncTest(name: string, fn: () => Promise<void>): Promise<void> {
  await fn();
  console.log(`  ✅ ${name}`);
}

export async function runUnitResponseTests(): Promise<void> {
  console.log('\n--- unit: lib/utils/response ---\n');

  await runAsyncTest(
    'successResponse returns 200 and body with success true and data',
    async () => {
      const res = successResponse({ id: '1' });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const body = (await res.json()) as { success?: boolean; data?: { id?: string } };
      assert(body.success === true, 'Expected success true');
      assert(body.data?.id === '1', 'Expected data.id');
    }
  );

  await runAsyncTest('successResponse includes optional message', async () => {
    const res = successResponse({ ok: true }, 'Done');
    const body = (await res.json()) as { message?: string };
    assert(body.message === 'Done', `Expected message Done, got ${body.message}`);
  });

  await runAsyncTest('errorResponse returns given status and body with success false', async () => {
    const res = errorResponse('Not found', 404);
    assert(res.status === 404, `Expected 404, got ${res.status}`);
    const body = (await res.json()) as { success?: boolean; error?: string };
    assert(body.success === false, 'Expected success false');
    assert(body.error === 'Not found', `Expected error message, got ${body.error}`);
  });

  await runAsyncTest('errorResponse defaults to 400 when status omitted', async () => {
    const res = errorResponse('Bad request');
    assert(res.status === 400, `Expected 400, got ${res.status}`);
  });

  await runAsyncTest('errorResponse includes code when provided', async () => {
    const res = errorResponse('Conflict', 409, 'CONFLICT');
    const body = (await res.json()) as { code?: string };
    assert(body.code === 'CONFLICT', 'Expected code');
  });
}

if (require.main === module) {
  runUnitResponseTests()
    .then(() => {
      console.log('\n✅ unit-response: all passed\n');
      process.exit(0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
