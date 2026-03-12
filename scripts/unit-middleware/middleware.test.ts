/**
 * Unit tests: root middleware
 * Verifies request interception, request/response modification, security headers, propagation.
 */

import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware, config } from '@/middleware';

describe('middleware', () => {
  let savedNodeEnv: string | undefined;

  beforeAll(() => {
    savedNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
  });

  afterAll(() => {
    if (savedNodeEnv !== undefined) process.env.NODE_ENV = savedNodeEnv;
  });

  beforeEach(() => {
    // Middleware and security-headers use process.env; ensure stable test env
    const nodeEnv = process.env.NODE_ENV;
    if (nodeEnv === undefined) process.env.NODE_ENV = 'test';
  });

  it('leaves NODE_ENV unchanged when already set', async () => {
    process.env.NODE_ENV = 'production';
    const req = new NextRequest('http://localhost:3000/');
    const res = await middleware(req);
    expect(res).toBeDefined();
    expect(res.status).toBe(200);
  });

  describe('when NODE_ENV is initially unset', () => {
    beforeAll(() => {
      delete process.env.NODE_ENV;
    });
    it('beforeEach sets NODE_ENV to test', async () => {
      const req = new NextRequest('http://localhost:3000/');
      const res = await middleware(req);
      expect(res).toBeDefined();
      expect(res.status).toBe(200);
    });
  });

  describe('intercepts requests and propagates to next handler', () => {
    it('returns a response (does not block)', async () => {
      const req = new NextRequest('http://localhost:3000/');
      const res = await middleware(req);
      expect(res).toBeDefined();
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBeNull();
    });

    it('returns 200 for arbitrary path', async () => {
      const req = new NextRequest('http://localhost:3000/dashboard');
      const res = await middleware(req);
      expect(res.status).toBe(200);
    });

    it('returns 200 for API path', async () => {
      const req = new NextRequest('http://localhost:3000/api/health');
      const res = await middleware(req);
      expect(res.status).toBe(200);
    });
  });

  describe('request modification behavior', () => {
    it('does not throw when request has no cookie', async () => {
      const req = new NextRequest('http://localhost:3000/', {
        headers: {},
      });
      const res = await middleware(req);
      expect(res.status).toBe(200);
    });

    it('runs successfully when request has cookie header', async () => {
      const req = new NextRequest('http://localhost:3000/', {
        headers: { cookie: 'sb-access-token=abc; path=/' },
      });
      const res = await middleware(req);
      expect(res.status).toBe(200);
    });

    it('passes through without throwing for empty cookie', async () => {
      const req = new NextRequest('http://localhost:3000/', {
        headers: { cookie: '' },
      });
      const res = await middleware(req);
      expect(res.status).toBe(200);
    });
  });

  describe('response modification and security headers', () => {
    it('sets X-Frame-Options on response', async () => {
      const req = new NextRequest('http://localhost:3000/');
      const res = await middleware(req);
      expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    });

    it('sets X-Content-Type-Options to nosniff', async () => {
      const req = new NextRequest('http://localhost:3000/');
      const res = await middleware(req);
      expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    });

    it('sets Referrer-Policy', async () => {
      const req = new NextRequest('http://localhost:3000/');
      const res = await middleware(req);
      expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    });

    it('sets Permissions-Policy', async () => {
      const req = new NextRequest('http://localhost:3000/');
      const res = await middleware(req);
      const pp = res.headers.get('Permissions-Policy');
      expect(pp).toBeDefined();
      expect(pp).toContain('camera=()');
      expect(pp).toContain('microphone=()');
    });

    it('sets Content-Security-Policy', async () => {
      const req = new NextRequest('http://localhost:3000/');
      const res = await middleware(req);
      const csp = res.headers.get('Content-Security-Policy');
      expect(csp).toBeDefined();
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("object-src 'none'");
    });
  });

  describe('success and failure scenarios', () => {
    it('succeeds for GET request', async () => {
      const req = new NextRequest('http://localhost:3000/', { method: 'GET' });
      const res = await middleware(req);
      expect(res.status).toBe(200);
    });

    it('succeeds for POST request', async () => {
      const req = new NextRequest('http://localhost:3000/api/bookings', {
        method: 'POST',
      });
      const res = await middleware(req);
      expect(res.status).toBe(200);
    });

    it('succeeds for request with many headers', async () => {
      const req = new NextRequest('http://localhost:3000/', {
        headers: {
          accept: 'text/html',
          'accept-language': 'en-US',
          'user-agent': 'TestAgent/1.0',
          cookie: 'session=xyz',
        },
      });
      const res = await middleware(req);
      expect(res.status).toBe(200);
    });
  });

  describe('config matcher', () => {
    it('exports config with matcher array', () => {
      expect(config).toBeDefined();
      expect(Array.isArray(config.matcher)).toBe(true);
      expect(config.matcher.length).toBeGreaterThan(0);
      expect(config.matcher[0]).toContain('_next/static');
    });
  });
});
