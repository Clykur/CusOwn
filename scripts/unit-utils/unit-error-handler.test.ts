#!/usr/bin/env ts-node
/**
 * Unit tests: lib/utils/error-handler
 * Pure: getUserFriendlyError, handleApiError. logError has side effects; test it does not throw.
 */

import { getUserFriendlyError, handleApiError, logError } from '../../lib/utils/error-handler';
import { ERROR_MESSAGES } from '../../config/constants';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function runTest(name: string, fn: () => void): void {
  fn();
  console.log(`  ✅ ${name}`);
}

async function runAsyncTest(name: string, fn: () => Promise<void>): Promise<void> {
  await fn();
  console.log(`  ✅ ${name}`);
}

export function runUnitErrorHandlerTests(): void {
  console.log('\n--- unit: lib/utils/error-handler ---\n');

  runTest('getUserFriendlyError returns string when error is string', () => {
    const out = getUserFriendlyError('Custom message');
    assert(out === 'Custom message', `Expected 'Custom message', got '${out}'`);
  });

  runTest('getUserFriendlyError returns network message for fetch errors', () => {
    const out = getUserFriendlyError(new Error('failed to fetch'));
    assert(
      out.includes('Unable to connect') || out.includes('internet'),
      `Expected network message, got '${out}'`
    );
  });

  runTest('getUserFriendlyError returns BOOKING_LINK_EXISTS for duplicate booking_link', () => {
    const out = getUserFriendlyError(new Error('unique constraint booking_link'));
    assert(
      out === ERROR_MESSAGES.BOOKING_LINK_EXISTS,
      `Expected BOOKING_LINK_EXISTS, got '${out}'`
    );
  });

  runTest('getUserFriendlyError returns CREATE_BUSINESS_FAILED for generic duplicate key', () => {
    const out = getUserFriendlyError(new Error('duplicate key value'));
    assert(
      out === ERROR_MESSAGES.CREATE_BUSINESS_FAILED,
      `Expected CREATE_BUSINESS_FAILED, got '${out}'`
    );
  });

  runTest('getUserFriendlyError returns validation message as-is when required/invalid', () => {
    const msg = 'Name is required';
    const out = getUserFriendlyError(new Error(msg));
    assert(out === msg, `Expected validation message, got '${out}'`);
  });

  runTest('getUserFriendlyError returns not found message for 404-like', () => {
    const out = getUserFriendlyError(new Error('not found'));
    assert(
      out.includes('not found') || out.includes('resource'),
      `Expected not found message, got '${out}'`
    );
  });

  runTest('getUserFriendlyError returns permission message for 403-like', () => {
    const out = getUserFriendlyError(new Error('unauthorized'));
    assert(
      out.toLowerCase().includes('permission') || out.toLowerCase().includes('denied'),
      `Expected permission message, got '${out}'`
    );
  });

  runTest('getUserFriendlyError returns generic fallback for unknown', () => {
    const out = getUserFriendlyError({});
    assert(
      out.includes('unexpected') || out.includes('try again'),
      `Expected generic fallback, got '${out}'`
    );
  });

  runTest(
    'getUserFriendlyError returns CREATE_BUSINESS_FAILED for database/query/constraint',
    () => {
      const out = getUserFriendlyError(new Error('database connection failed'));
      assert(
        out === ERROR_MESSAGES.CREATE_BUSINESS_FAILED,
        `Expected CREATE_BUSINESS_FAILED, got '${out}'`
      );
    }
  );

  runTest('getUserFriendlyError returns server message for 500-like', () => {
    const out = getUserFriendlyError(new Error('500 internal server error'));
    assert(
      out.includes('server') || out.includes('internal'),
      `Expected server message, got '${out}'`
    );
  });

  runTest('getUserFriendlyError returns QR message for qr/qrcode errors', () => {
    const out = getUserFriendlyError(new Error('qr code generation failed'));
    assert(
      out.includes('QR') || out.includes('qrcode') || out.includes('dashboard'),
      `Expected QR message, got '${out}'`
    );
  });

  runTest('getUserFriendlyError returns short message as-is when user-friendly', () => {
    const msg = 'Slot no longer available';
    const out = getUserFriendlyError(new Error(msg));
    assert(out === msg, `Expected message as-is, got '${out}'`);
  });

  runTest('logError does not throw', () => {
    logError(new Error('test'));
    logError('string', 'context');
  });
}

export async function runUnitErrorHandlerAsyncTests(): Promise<void> {
  runAsyncTest('handleApiError returns message for 400 status', async () => {
    const res = new Response(JSON.stringify({}), { status: 400 });
    const out = await handleApiError(res);
    assert(
      out.toLowerCase().includes('invalid') || out.toLowerCase().includes('request'),
      `Expected 400 message, got '${out}'`
    );
  });

  runAsyncTest('handleApiError returns message for 401 status', async () => {
    const res = new Response(JSON.stringify({}), { status: 401 });
    const out = await handleApiError(res);
    assert(
      out.toLowerCase().includes('authorized') || out.toLowerCase().includes('auth'),
      `Expected 401 message, got '${out}'`
    );
  });

  runAsyncTest('handleApiError uses data.error when present', async () => {
    const res = new Response(JSON.stringify({ error: 'Custom API error' }), { status: 400 });
    const out = await handleApiError(res);
    assert(out === 'Custom API error', `Expected API error text, got '${out}'`);
  });

  runAsyncTest('handleApiError returns 429 message for rate limit', async () => {
    const res = new Response(JSON.stringify({}), { status: 429 });
    const out = await handleApiError(res);
    assert(
      out.toLowerCase().includes('many') || out.toLowerCase().includes('wait'),
      `Expected 429 message, got '${out}'`
    );
  });

  runAsyncTest('handleApiError returns message for 403 status', async () => {
    const res = new Response(JSON.stringify({}), { status: 403 });
    const out = await handleApiError(res);
    assert(
      out.toLowerCase().includes('denied') || out.toLowerCase().includes('permission'),
      `Expected 403 message, got '${out}'`
    );
  });

  runAsyncTest('handleApiError returns message for 404 status', async () => {
    const res = new Response(JSON.stringify({}), { status: 404 });
    const out = await handleApiError(res);
    assert(out.toLowerCase().includes('not found'), `Expected 404 message, got '${out}'`);
  });

  runAsyncTest('handleApiError returns message for 409 status', async () => {
    const res = new Response(JSON.stringify({}), { status: 409 });
    const out = await handleApiError(res);
    assert(
      out.toLowerCase().includes('conflict') || out.toLowerCase().includes('exists'),
      `Expected 409 message, got '${out}'`
    );
  });

  runAsyncTest('handleApiError returns message for 500 status', async () => {
    const res = new Response(JSON.stringify({}), { status: 500 });
    const out = await handleApiError(res);
    assert(
      out.toLowerCase().includes('server') || out.toLowerCase().includes('error'),
      `Expected 500 message, got '${out}'`
    );
  });

  runAsyncTest('handleApiError returns message for 503 status', async () => {
    const res = new Response(JSON.stringify({}), { status: 503 });
    const out = await handleApiError(res);
    assert(
      out.toLowerCase().includes('unavailable') || out.toLowerCase().includes('try again'),
      `Expected 503 message, got '${out}'`
    );
  });

  runAsyncTest('handleApiError uses data.message when present and no data.error', async () => {
    const res = new Response(JSON.stringify({ message: 'Validation failed' }), { status: 400 });
    const out = await handleApiError(res);
    assert(out === 'Validation failed', `Expected message body, got '${out}'`);
  });

  runAsyncTest(
    'handleApiError returns status-based message when response is not JSON',
    async () => {
      const res = new Response('not json', { status: 401 });
      const out = await handleApiError(res);
      assert(
        out.toLowerCase().includes('authorized') || out.toLowerCase().includes('auth'),
        `Expected 401 fallback, got '${out}'`
      );
    }
  );

  runAsyncTest('handleApiError returns generic message for unknown status', async () => {
    const res = new Response(JSON.stringify({}), { status: 418 });
    const out = await handleApiError(res);
    assert(
      out.includes('error') || out.includes('try again'),
      `Expected generic message, got '${out}'`
    );
  });
}

if (require.main === module) {
  runUnitErrorHandlerTests();
  runUnitErrorHandlerAsyncTests()
    .then(() => {
      console.log('\n✅ unit-error-handler: all passed\n');
      process.exit(0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
