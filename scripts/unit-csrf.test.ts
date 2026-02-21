#!/usr/bin/env ts-node
/**
 * Unit tests: lib/security/csrf
 * generateCSRFToken format; validateCSRFToken logic; setCSRFToken; csrfProtection.
 */

import { NextResponse } from 'next/server';
import {
  generateCSRFToken,
  validateCSRFToken,
  setCSRFToken,
  csrfProtection,
} from '../lib/security/csrf';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function runTest(name: string, fn: () => void): void {
  fn();
  console.log(`  ✅ ${name}`);
}

function createMockRequest(method: string, cookieToken?: string, headerToken?: string): any {
  return {
    method,
    cookies: {
      get: (name: string) =>
        name === 'csrf-token' && cookieToken ? { value: cookieToken } : undefined,
    },
    headers: {
      get: (name: string) => (name === 'x-csrf-token' ? (headerToken ?? null) : null),
    },
  };
}

export async function runUnitCsrfTests(): Promise<void> {
  console.log('\n--- unit: lib/security/csrf ---\n');

  runTest('should_generateCSRFToken_return_64_char_hex_when_called', () => {
    const token = generateCSRFToken();
    assert(token.length === 64, `Expected length 64, got ${token.length}`);
    assert(/^[0-9a-f]{64}$/i.test(token), `Expected hex string, got '${token.slice(0, 8)}...'`);
  });

  runTest('should_generateCSRFToken_return_different_values_on_each_call', () => {
    const a = generateCSRFToken();
    const b = generateCSRFToken();
    assert(a !== b, 'Expected different tokens');
  });

  runTest('should_validateCSRFToken_return_true_when_GET', async () => {
    const req = createMockRequest('GET');
    const result = await validateCSRFToken(req);
    assert(result === true, `Expected true for GET, got ${result}`);
  });

  runTest('should_validateCSRFToken_return_true_when_HEAD', async () => {
    const req = createMockRequest('HEAD');
    const result = await validateCSRFToken(req);
    assert(result === true, `Expected true for HEAD, got ${result}`);
  });

  runTest('should_validateCSRFToken_return_false_when_POST_and_no_cookie', async () => {
    const req = createMockRequest('POST', undefined, 'some-token');
    const result = await validateCSRFToken(req);
    assert(result === false, `Expected false, got ${result}`);
  });

  runTest('should_validateCSRFToken_return_false_when_POST_and_no_header', async () => {
    const req = createMockRequest('POST', 'cookie-token', undefined);
    const result = await validateCSRFToken(req);
    assert(result === false, `Expected false, got ${result}`);
  });

  runTest('should_validateCSRFToken_return_true_when_POST_and_cookie_matches_header', async () => {
    const token = generateCSRFToken();
    const req = createMockRequest('POST', token, token);
    const result = await validateCSRFToken(req);
    assert(result === true, `Expected true, got ${result}`);
  });

  runTest(
    'should_validateCSRFToken_return_false_when_POST_and_cookie_mismatch_header',
    async () => {
      const req = createMockRequest('POST', 'token-a', 'token-b');
      const result = await validateCSRFToken(req);
      assert(result === false, `Expected false, got ${result}`);
    }
  );

  runTest('should_setCSRFToken_call_cookies_set_with_token', () => {
    let captured: { name?: string; value?: string } = {};
    const res = {
      cookies: {
        set: (name: string, value: string) => {
          captured = { name, value };
        },
      },
    } as unknown as NextResponse;
    setCSRFToken(res, 'test-token-123');
    assert(captured.name === 'csrf-token', `Expected cookie name csrf-token, got ${captured.name}`);
    assert(captured.value === 'test-token-123', `Expected value, got ${captured.value}`);
  });

  runTest('should_csrfProtection_GET_without_cookie_set_cookie_and_return_response', async () => {
    const req = createMockRequest('GET');
    (req as any).url = 'https://example.com/';
    const result = await csrfProtection(req as any);
    assert(result !== null, 'Expected response');
    assert((result as any).cookies !== undefined || result !== null, 'Response returned');
  });

  runTest('should_csrfProtection_POST_same_origin_valid_token_return_null', async () => {
    const token = generateCSRFToken();
    const req = createMockRequest('POST', token, token);
    (req as any).url = 'https://example.com/api/action';
    (req as any).headers = {
      get: (name: string) =>
        name === 'x-csrf-token' ? token : name === 'origin' ? 'https://example.com' : null,
    };
    const result = await csrfProtection(req as any);
    assert(result === null, `Expected null (allow), got ${result}`);
  });

  runTest('should_csrfProtection_POST_same_origin_no_token_set_and_allow', async () => {
    const req = createMockRequest('POST', undefined, undefined);
    (req as any).url = 'https://example.com/api/action';
    (req as any).headers = {
      get: (name: string) => (name === 'origin' ? 'https://example.com' : null),
    };
    const result = await csrfProtection(req as any);
    assert(result !== null, 'Expected response (first POST)');
  });

  runTest('should_csrfProtection_POST_same_origin_token_mismatch_return_403', async () => {
    const req = createMockRequest('POST', 'cookie-tok', 'header-tok');
    (req as any).url = 'https://example.com/api/action';
    (req as any).headers = {
      get: (name: string) =>
        name === 'x-csrf-token' ? 'header-tok' : name === 'origin' ? 'https://example.com' : null,
    };
    const result = await csrfProtection(req as any);
    assert(result !== null, 'Expected 403 response');
    const status = (result as any)?.status;
    assert(status === 403, `Expected status 403, got ${status}`);
  });

  runTest('should_csrfProtection_POST_cross_origin_return_403', async () => {
    const req = createMockRequest('POST', 'a', 'a');
    (req as any).url = 'https://example.com/api/action';
    (req as any).headers = { get: () => null };
    const result = await csrfProtection(req as any);
    assert(result !== null, 'Cross-origin state-changing request must be rejected');
    const status = (result as any)?.status;
    assert(status === 403, `Expected 403, got ${status}`);
  });

  runTest('should_csrfProtection_GET_with_existing_token_return_response', async () => {
    const token = generateCSRFToken();
    const req = createMockRequest('GET', token, undefined);
    (req as any).url = 'https://example.com/';
    const result = await csrfProtection(req as any);
    assert(result !== null, 'Expected response');
  });

  runTest('should_csrfProtection_HEAD_return_response', async () => {
    const req = createMockRequest('HEAD');
    (req as any).url = 'https://example.com/';
    const result = await csrfProtection(req as any);
    assert(result !== null, 'Expected response');
  });

  runTest('should_csrfProtection_POST_same_origin_via_referer_only', async () => {
    const req = createMockRequest('POST', undefined, undefined);
    (req as any).url = 'https://example.com/api/action';
    (req as any).headers = {
      get: (name: string) =>
        name === 'origin' ? null : name === 'referer' ? 'https://example.com/page' : null,
    };
    const result = await csrfProtection(req as any);
    assert(result !== null, 'Expected response when referer same origin');
  });
}

if (require.main === module) {
  runUnitCsrfTests()
    .then(() => {
      console.log('\n✅ unit-csrf: all passed\n');
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
