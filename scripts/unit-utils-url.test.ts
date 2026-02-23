#!/usr/bin/env ts-node
/**
 * Unit tests: lib/utils/url
 * getBaseUrl (with mock request), getBookingUrl, getBookingStatusUrl, getApiUrl, getClientBaseUrl.
 */

import {
  getBaseUrl,
  getBookingUrl,
  getBookingStatusUrl,
  getApiUrl,
  getClientBaseUrl,
} from '../lib/utils/url';

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

  runTest('should_getBaseUrl_return_NEXT_PUBLIC_APP_URL_when_set', () => {
    const prev = process.env.NEXT_PUBLIC_APP_URL;
    const prevVercel = process.env.VERCEL_URL;
    try {
      process.env.NEXT_PUBLIC_APP_URL = 'https://myapp.test';
      process.env.VERCEL_URL = '';
      const base = getBaseUrl();
      assert(base === 'https://myapp.test', `Expected myapp.test, got ${base}`);
    } finally {
      process.env.NEXT_PUBLIC_APP_URL = prev;
      process.env.VERCEL_URL = prevVercel;
    }
  });

  runTest('should_getBaseUrl_return_VERCEL_URL_https_when_set_and_no_app_url', () => {
    const prev = process.env.NEXT_PUBLIC_APP_URL;
    const prevVercel = process.env.VERCEL_URL;
    try {
      process.env.NEXT_PUBLIC_APP_URL = '';
      process.env.VERCEL_URL = 'myproject.vercel.app';
      const base = getBaseUrl();
      assert(base === 'https://myproject.vercel.app', `Expected vercel URL, got ${base}`);
    } finally {
      process.env.NEXT_PUBLIC_APP_URL = prev;
      process.env.VERCEL_URL = prevVercel;
    }
  });

  runTest('should_getBaseUrl_return_production_fallback_when_NODE_ENV_production', () => {
    const prevNode = process.env.NODE_ENV;
    const prevApp = process.env.NEXT_PUBLIC_APP_URL;
    const prevVercel = process.env.VERCEL_URL;
    try {
      process.env.NODE_ENV = 'production';
      process.env.NEXT_PUBLIC_APP_URL = '';
      process.env.VERCEL_URL = '';
      const base = getBaseUrl();
      assert(base === 'https://cusown.clykur.com', `Expected production URL, got ${base}`);
    } finally {
      process.env.NODE_ENV = prevNode;
      process.env.NEXT_PUBLIC_APP_URL = prevApp;
      process.env.VERCEL_URL = prevVercel;
    }
  });

  runTest('should_getBaseUrl_return_localhost_fallback_when_NEXT_PUBLIC_APP_URL_unset', () => {
    const prevNode = process.env.NODE_ENV;
    const prevApp = process.env.NEXT_PUBLIC_APP_URL;
    const prevVercel = process.env.VERCEL_URL;
    try {
      process.env.NODE_ENV = 'development';
      process.env.NEXT_PUBLIC_APP_URL = '';
      process.env.VERCEL_URL = '';
      const base = getBaseUrl();
      assert(base === 'http://localhost:3000', `Expected localhost fallback, got ${base}`);
    } finally {
      process.env.NODE_ENV = prevNode;
      process.env.NEXT_PUBLIC_APP_URL = prevApp;
      process.env.VERCEL_URL = prevVercel;
    }
  });

  runTest('should_getBaseUrl_return_fallback_when_appUrl_is_localhost', () => {
    const prevNode = process.env.NODE_ENV;
    const prevApp = process.env.NEXT_PUBLIC_APP_URL;
    const prevVercel = process.env.VERCEL_URL;
    try {
      process.env.NODE_ENV = 'development';
      process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
      process.env.VERCEL_URL = '';
      const base = getBaseUrl();
      assert(
        base === 'http://localhost:3000' || base.startsWith('http'),
        `Expected localhost or http, got ${base}`
      );
    } finally {
      process.env.NODE_ENV = prevNode;
      process.env.NEXT_PUBLIC_APP_URL = prevApp;
      process.env.VERCEL_URL = prevVercel;
    }
  });

  runTest('should_getBaseUrl_catch_block_then_final_return', () => {
    const prevNode = (process.versions as any).node;
    const prevWindow = (globalThis as any).window;
    try {
      delete (process.versions as any).node;
      (globalThis as any).window = {
        get location() {
          throw new Error('access');
        },
      };
      const base = getBaseUrl();
      assert(
        typeof base === 'string' && base.length > 0,
        `Expected string after catch, got ${base}`
      );
    } finally {
      (process.versions as any).node = prevNode;
      (globalThis as any).window = prevWindow;
    }
  });

  runTest('should_getBaseUrl_final_return_ternary_true_when_browser_path', () => {
    const prevNode = (process.versions as any).node;
    const prevWindow = (globalThis as any).window;
    const prevNodeEnv = process.env.NODE_ENV;
    const prevApp = process.env.NEXT_PUBLIC_APP_URL;
    const prevVercel = process.env.VERCEL_URL;
    try {
      delete (process.versions as any).node;
      (globalThis as any).window = {
        get location() {
          throw new Error('x');
        },
      };
      process.env.NODE_ENV = 'production';
      process.env.NEXT_PUBLIC_APP_URL = '';
      process.env.VERCEL_URL = '';
      const base = getBaseUrl();
      assert(base === 'https://cusown.clykur.com', `Expected production URL, got ${base}`);
    } finally {
      (process.versions as any).node = prevNode;
      (globalThis as any).window = prevWindow;
      process.env.NODE_ENV = prevNodeEnv;
      process.env.NEXT_PUBLIC_APP_URL = prevApp;
      process.env.VERCEL_URL = prevVercel;
    }
  });

  runTest('should_getBaseUrl_final_return_ternary_false_when_browser_path', () => {
    const prevNode = (process.versions as any).node;
    const prevWindow = (globalThis as any).window;
    const prevNodeEnv = process.env.NODE_ENV;
    const prevApp = process.env.NEXT_PUBLIC_APP_URL;
    const prevVercel = process.env.VERCEL_URL;
    try {
      delete (process.versions as any).node;
      (globalThis as any).window = {
        get location() {
          throw new Error('x');
        },
      };
      process.env.NODE_ENV = 'development';
      process.env.NEXT_PUBLIC_APP_URL = '';
      process.env.VERCEL_URL = '';
      const base = getBaseUrl();
      assert(
        base === 'http://localhost:3000' || (base.length > 0 && base.startsWith('http')),
        `Expected fallback, got ${base}`
      );
    } finally {
      (process.versions as any).node = prevNode;
      (globalThis as any).window = prevWindow;
      process.env.NODE_ENV = prevNodeEnv;
      process.env.NEXT_PUBLIC_APP_URL = prevApp;
      process.env.VERCEL_URL = prevVercel;
    }
  });

  runTest('should_getBaseUrl_return_window_origin_when_browser_and_no_request', () => {
    const prevNode = (process.versions as any).node;
    const prevWindow = (globalThis as any).window;
    try {
      delete (process.versions as any).node;
      (globalThis as any).window = { location: { origin: 'https://browser-origin.test' } };
      const base = getBaseUrl();
      assert(base === 'https://browser-origin.test', `Expected browser origin, got ${base}`);
    } finally {
      (process.versions as any).node = prevNode;
      (globalThis as any).window = prevWindow;
    }
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

  runTest('should_getClientBaseUrl_return_NEXT_PUBLIC_APP_URL_when_set', () => {
    const prev = process.env.NEXT_PUBLIC_APP_URL;
    const prevVercel = process.env.VERCEL_URL;
    try {
      process.env.NEXT_PUBLIC_APP_URL = 'https://client.test';
      process.env.VERCEL_URL = '';
      const base = getClientBaseUrl();
      assert(base === 'https://client.test', `Expected client.test, got ${base}`);
    } finally {
      process.env.NEXT_PUBLIC_APP_URL = prev;
      process.env.VERCEL_URL = prevVercel;
    }
  });

  runTest('should_getClientBaseUrl_return_VERCEL_URL_when_set_and_no_app_url', () => {
    const prev = process.env.NEXT_PUBLIC_APP_URL;
    const prevVercel = process.env.VERCEL_URL;
    try {
      process.env.NEXT_PUBLIC_APP_URL = '';
      process.env.VERCEL_URL = 'client.vercel.app';
      const base = getClientBaseUrl();
      assert(base === 'https://client.vercel.app', `Expected vercel, got ${base}`);
    } finally {
      process.env.NEXT_PUBLIC_APP_URL = prev;
      process.env.VERCEL_URL = prevVercel;
    }
  });

  runTest('should_getClientBaseUrl_return_production_when_NODE_ENV_production', () => {
    const prevNode = process.env.NODE_ENV;
    const prevApp = process.env.NEXT_PUBLIC_APP_URL;
    const prevVercel = process.env.VERCEL_URL;
    try {
      process.env.NODE_ENV = 'production';
      process.env.NEXT_PUBLIC_APP_URL = '';
      process.env.VERCEL_URL = '';
      const base = getClientBaseUrl();
      assert(base === 'https://cusown.clykur.com', `Expected production, got ${base}`);
    } finally {
      process.env.NODE_ENV = prevNode;
      process.env.NEXT_PUBLIC_APP_URL = prevApp;
      process.env.VERCEL_URL = prevVercel;
    }
  });

  runTest('should_getClientBaseUrl_return_localhost_when_development', () => {
    const prevNode = process.env.NODE_ENV;
    const prevApp = process.env.NEXT_PUBLIC_APP_URL;
    const prevVercel = process.env.VERCEL_URL;
    try {
      process.env.NODE_ENV = 'development';
      process.env.NEXT_PUBLIC_APP_URL = '';
      process.env.VERCEL_URL = '';
      const base = getClientBaseUrl();
      assert(base === 'http://localhost:3000', `Expected localhost, got ${base}`);
    } finally {
      process.env.NODE_ENV = prevNode;
      process.env.NEXT_PUBLIC_APP_URL = prevApp;
      process.env.VERCEL_URL = prevVercel;
    }
  });

  runTest('should_getClientBaseUrl_fallback_when_isNode_false', () => {
    const prevNode = (process.versions as any).node;
    const prevApp = process.env.NEXT_PUBLIC_APP_URL;
    const prevVercel = process.env.VERCEL_URL;
    try {
      delete (process.versions as any).node;
      process.env.NEXT_PUBLIC_APP_URL = '';
      process.env.VERCEL_URL = '';
      const base = getClientBaseUrl();
      assert(typeof base === 'string' && base.length > 0, `Expected string, got ${base}`);
    } finally {
      (process.versions as any).node = prevNode;
      process.env.NEXT_PUBLIC_APP_URL = prevApp;
      process.env.VERCEL_URL = prevVercel;
    }
  });

  runTest('should_getClientBaseUrl_fallback_appUrl_then_vercel_then_return', () => {
    const prevNode = (process.versions as any).node;
    const prevApp = process.env.NEXT_PUBLIC_APP_URL;
    const prevVercel = process.env.VERCEL_URL;
    const prevWindow = (globalThis as any).window;
    try {
      delete (process.versions as any).node;
      (globalThis as any).window = undefined;
      process.env.NEXT_PUBLIC_APP_URL = 'https://fallback-app.test';
      process.env.VERCEL_URL = '';
      const base = getClientBaseUrl();
      assert(base === 'https://fallback-app.test', `Expected fallback app, got ${base}`);
    } finally {
      (process.versions as any).node = prevNode;
      process.env.NEXT_PUBLIC_APP_URL = prevApp;
      process.env.VERCEL_URL = prevVercel;
      (globalThis as any).window = prevWindow;
    }
  });

  runTest('should_getClientBaseUrl_fallback_vercel_when_no_app_url', () => {
    const prevNode = (process.versions as any).node;
    const prevApp = process.env.NEXT_PUBLIC_APP_URL;
    const prevVercel = process.env.VERCEL_URL;
    const prevWindow = (globalThis as any).window;
    try {
      delete (process.versions as any).node;
      (globalThis as any).window = undefined;
      process.env.NEXT_PUBLIC_APP_URL = '';
      process.env.VERCEL_URL = 'fallback.vercel.app';
      const base = getClientBaseUrl();
      assert(base === 'https://fallback.vercel.app', `Expected fallback vercel, got ${base}`);
    } finally {
      (process.versions as any).node = prevNode;
      process.env.NEXT_PUBLIC_APP_URL = prevApp;
      process.env.VERCEL_URL = prevVercel;
      (globalThis as any).window = prevWindow;
    }
  });

  runTest('should_getClientBaseUrl_fallback_final_return_when_no_env', () => {
    const prevNode = (process.versions as any).node;
    const prevApp = process.env.NEXT_PUBLIC_APP_URL;
    const prevVercel = process.env.VERCEL_URL;
    const prevWindow = (globalThis as any).window;
    try {
      delete (process.versions as any).node;
      (globalThis as any).window = undefined;
      process.env.NEXT_PUBLIC_APP_URL = '';
      process.env.VERCEL_URL = '';
      const base = getClientBaseUrl();
      assert(
        typeof base === 'string' &&
          (base === 'https://cusown.clykur.com' || base.startsWith('http')),
        `Expected URL, got ${base}`
      );
    } finally {
      (process.versions as any).node = prevNode;
      process.env.NEXT_PUBLIC_APP_URL = prevApp;
      process.env.VERCEL_URL = prevVercel;
      (globalThis as any).window = prevWindow;
    }
  });

  runTest('should_getClientBaseUrl_fallback_ternary_true', () => {
    const prevNode = (process.versions as any).node;
    const prevWindow = (globalThis as any).window;
    const prevNodeEnv = process.env.NODE_ENV;
    const prevApp = process.env.NEXT_PUBLIC_APP_URL;
    const prevVercel = process.env.VERCEL_URL;
    try {
      delete (process.versions as any).node;
      (globalThis as any).window = undefined;
      process.env.NODE_ENV = 'production';
      process.env.NEXT_PUBLIC_APP_URL = '';
      process.env.VERCEL_URL = '';
      const base = getClientBaseUrl();
      assert(base === 'https://cusown.clykur.com', `Expected production, got ${base}`);
    } finally {
      (process.versions as any).node = prevNode;
      (globalThis as any).window = prevWindow;
      process.env.NODE_ENV = prevNodeEnv;
      process.env.NEXT_PUBLIC_APP_URL = prevApp;
      process.env.VERCEL_URL = prevVercel;
    }
  });

  runTest('should_getClientBaseUrl_fallback_ternary_false', () => {
    const prevNode = (process.versions as any).node;
    const prevWindow = (globalThis as any).window;
    const prevNodeEnv = process.env.NODE_ENV;
    const prevApp = process.env.NEXT_PUBLIC_APP_URL;
    const prevVercel = process.env.VERCEL_URL;
    try {
      delete (process.versions as any).node;
      (globalThis as any).window = undefined;
      process.env.NODE_ENV = 'development';
      process.env.NEXT_PUBLIC_APP_URL = '';
      process.env.VERCEL_URL = '';
      const base = getClientBaseUrl();
      assert(base === 'http://localhost:3000', `Expected localhost, got ${base}`);
    } finally {
      (process.versions as any).node = prevNode;
      (globalThis as any).window = prevWindow;
      process.env.NODE_ENV = prevNodeEnv;
      process.env.NEXT_PUBLIC_APP_URL = prevApp;
      process.env.VERCEL_URL = prevVercel;
    }
  });

  runTest('should_getClientBaseUrl_return_env_baseUrl_when_appUrl_localhost', () => {
    const prevNode = process.env.NODE_ENV;
    const prevApp = process.env.NEXT_PUBLIC_APP_URL;
    const prevVercel = process.env.VERCEL_URL;
    try {
      process.env.NODE_ENV = 'development';
      process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
      process.env.VERCEL_URL = '';
      const base = getClientBaseUrl();
      assert(base === 'http://localhost:3000', `Expected localhost, got ${base}`);
    } finally {
      process.env.NODE_ENV = prevNode;
      process.env.NEXT_PUBLIC_APP_URL = prevApp;
      process.env.VERCEL_URL = prevVercel;
    }
  });

  runTest('should_getClientBaseUrl_return_window_origin_when_browser', () => {
    const prevNode = (process.versions as any).node;
    const prevWindow = (globalThis as any).window;
    try {
      delete (process.versions as any).node;
      (globalThis as any).window = { location: { origin: 'https://client-browser.test' } };
      const base = getClientBaseUrl();
      assert(base === 'https://client-browser.test', `Expected client browser origin, got ${base}`);
    } finally {
      (process.versions as any).node = prevNode;
      (globalThis as any).window = prevWindow;
    }
  });

  runTest('should_getClientBaseUrl_catch_block', () => {
    const prevNode = (process.versions as any).node;
    const prevWindow = (globalThis as any).window;
    try {
      delete (process.versions as any).node;
      (globalThis as any).window = {
        get location() {
          throw new Error('client');
        },
      };
      const base = getClientBaseUrl();
      assert(
        typeof base === 'string' && base.length > 0,
        `Expected string after catch, got ${base}`
      );
    } finally {
      (process.versions as any).node = prevNode;
      (globalThis as any).window = prevWindow;
    }
  });

  runTest('should_getBaseUrl_without_request_return_string_in_node', () => {
    const base = getBaseUrl();
    assert(typeof base === 'string' && base.length > 0, `Expected non-empty string, got ${base}`);
  });
}

if (require.main === module) {
  runUnitUtilsUrlTests();
  console.log('\n✅ unit-utils-url: all passed\n');
}
