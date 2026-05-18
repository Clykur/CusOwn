#!/usr/bin/env ts-node
/**
 * Unit tests: lib/utils/url
 * getBaseUrl (NextRequest + smoke), getBookingUrl, getBookingStatusUrl, getApiUrl (url.server).
 */

import { getBaseUrl, getBookingUrl, getBookingStatusUrl, getApiUrl } from '@/lib/utils/url.server';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function runTest(name: string, fn: () => void): void {
  fn();
  console.log(`  ✅ ${name}`);
}

function createMockRequest(
  origin: string,
  host?: string | null,
  xForwardedProto?: string | null
): any {
  return {
    nextUrl: { origin },
    headers: {
      get: (name: string) => {
        if (name === 'host') return host !== undefined ? host : new URL(origin).host;
        if (name === 'x-forwarded-proto') return xForwardedProto ?? null;
        return null;
      },
    },
  };
}

export function runUnitUtilsUrlTests(): void {
  console.log('\n--- unit: lib/utils/url ---\n');

  runTest('should_getBaseUrl_return_origin_when_request_has_origin', () => {
    const req = createMockRequest('https://custom.example.com') as any;
    const base = getBaseUrl(req);
    assert(base === 'https://custom.example.com', `Expected custom origin, got ${base}`);
  });

  runTest('should_getBaseUrl_use_host_and_protocol_when_origin_localhost', () => {
    const req = {
      nextUrl: { origin: 'http://localhost:3000' },
      headers: {
        get: (name: string) =>
          name === 'host' ? 'myhost:3000' : name === 'x-forwarded-proto' ? 'https' : null,
      },
    } as any;
    const base = getBaseUrl(req);
    assert(base === 'https://myhost:3000', `Expected https://myhost:3000, got ${base}`);
  });

  runTest('should_getBaseUrl_use_http_when_host_is_localhost_and_no_x_forwarded_proto', () => {
    const req = createMockRequest('http://127.0.0.1:3000', 'localhost:3000', null) as any;
    const base = getBaseUrl(req);
    assert(base === 'http://localhost:3000', `Expected http://localhost:3000, got ${base}`);
  });

  runTest('should_getBaseUrl_use_https_when_host_non_localhost_no_x_forwarded_proto', () => {
    const req = createMockRequest('http://127.0.0.1:3000', 'app.example.com:443', null) as any;
    const base = getBaseUrl(req);
    assert(base === 'https://app.example.com:443', `Expected https, got ${base}`);
  });

  runTest('should_getBaseUrl_fall_through_to_node_when_request_has_no_host', () => {
    const req = {
      nextUrl: { origin: 'http://localhost:3000' },
      headers: { get: () => null },
    } as any;
    const base = getBaseUrl(req);
    assert(typeof base === 'string' && base.length > 0, `Expected string, got ${base}`);
  });

  // Legacy tests that mutated process.env / globalThis.window were valid when url.ts read
  // process.env directly. @cusown/config `publicEnv` is fixed at import time — use Vitest mocks
  // or a subprocess if you need to assert env permutations again.
  runTest('should_getBaseUrl_without_request_returns_non_empty_string', () => {
    const base = getBaseUrl();
    assert(typeof base === 'string' && base.length > 0, `Smoke: got ${base}`);
  });

  runTest('should_getBookingUrl_include_base_and_prefix_and_link', () => {
    const req = createMockRequest('https://app.com') as any;
    const url = getBookingUrl('my-link', req);
    assert(url === 'https://app.com/book/my-link', `Expected booking URL, got ${url}`);
  });

  runTest('should_getBookingStatusUrl_include_booking_id', () => {
    const req = createMockRequest('https://app.com') as any;
    const url = getBookingStatusUrl('booking-id-123', req);
    assert(url === 'https://app.com/booking/booking-id-123', `Expected status URL, got ${url}`);
  });

  runTest('should_getApiUrl_include_path', () => {
    const req = createMockRequest('https://app.com') as any;
    const url = getApiUrl('/api/slots', req);
    assert(url === 'https://app.com/api/slots', `Expected API URL, got ${url}`);
  });

  // getClientBaseUrl() mirrors getBaseUrl() from @cusown/config; env-mutation tests removed (see above).
}

if (require.main === module) {
  runUnitUtilsUrlTests();
  console.log('\n✅ unit-utils-url: all passed\n');
}
