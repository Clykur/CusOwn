/**
 * Unit tests: lib/middleware/rate-limit
 * Verifies rateLimit middleware, request interception, and 429 when over limit.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { rateLimit, apiRateLimit, bookingRateLimit } from '@/lib/middleware/rate-limit';

vi.mock('@/lib/utils/security', () => ({
  getClientIp: vi.fn(() => '192.168.1.1'),
}));

describe('rate-limit middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rateLimit', () => {
    it('returns null when under max requests', async () => {
      const middleware = rateLimit({ windowMs: 60000, maxRequests: 5 });
      const req = new NextRequest('http://localhost/api/test', { method: 'GET' });
      for (let i = 0; i < 3; i++) {
        const res = await middleware(req);
        expect(res).toBeNull();
      }
    });

    it('returns 429 when over max requests in same window', async () => {
      const middleware = rateLimit({ windowMs: 60000, maxRequests: 2 });
      const req = new NextRequest('http://localhost/api/test', { method: 'GET' });
      await middleware(req);
      await middleware(req);
      const res = await middleware(req);
      expect(res).not.toBeNull();
      expect(res?.status).toBe(429);
      const body = (await res?.json()) as { error?: string };
      expect(body.error).toMatch(/many requests|try again/i);
    });

    it('uses custom keyGenerator when provided', async () => {
      const middleware = rateLimit({
        windowMs: 60000,
        maxRequests: 1,
        keyGenerator: (r) => `custom:${r.url}`,
      });
      const req = new NextRequest('http://localhost/api/a', { method: 'GET' });
      await middleware(req);
      const res = await middleware(req);
      expect(res?.status).toBe(429);
    });
  });

  describe('apiRateLimit', () => {
    it('returns null for first request', async () => {
      const req = new NextRequest('http://localhost/api/health', { method: 'GET' });
      const res = await apiRateLimit(req);
      expect(res).toBeNull();
    });
  });

  describe('bookingRateLimit', () => {
    it('returns null for first request', async () => {
      const req = new NextRequest('http://localhost/api/bookings', { method: 'POST' });
      const res = await bookingRateLimit(req);
      expect(res).toBeNull();
    });
  });
});
