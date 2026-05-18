/**
 * Unit tests: apps/app proxy (Next middleware entry).
 * Proxy handles auth redirects and private routes; security headers are applied elsewhere.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy as middleware, config } from '@/proxy';

const mockGetUser = vi.fn().mockResolvedValue({ data: { user: null } });

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: {
      getUser: (...args: unknown[]) => mockGetUser(...args),
    },
  }),
}));

vi.mock('@cusown/shared/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@cusown/shared/server')>();
  return {
    ...actual,
    getUserState: vi.fn().mockResolvedValue({ redirectUrl: '/customer/dashboard' }),
  };
});

/** Path that passes through without home/dashboard redirects when unauthenticated. */
const PASS_THROUGH_URL = 'http://localhost:3000/api/health';

describe('middleware (proxy)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: null } });
    process.env.NODE_ENV = 'test';
  });

  describe('intercepts requests and propagates to next handler', () => {
    it('returns a response (does not block)', async () => {
      const req = new NextRequest(PASS_THROUGH_URL);
      const res = await middleware(req);
      expect(res).toBeDefined();
      expect(res.status).toBe(200);
    });

    it('returns 200 for API path', async () => {
      const req = new NextRequest('http://localhost:3000/api/health');
      const res = await middleware(req);
      expect(res.status).toBe(200);
    });

    it('redirects unauthenticated users from private routes to login', async () => {
      const req = new NextRequest('http://localhost:3000/customer/dashboard');
      const res = await middleware(req);
      expect(res.status).toBeGreaterThanOrEqual(300);
      expect(res.status).toBeLessThan(400);
      expect(res.headers.get('location')).toMatch(/auth\/login/);
    });
  });

  describe('request modification behavior', () => {
    it('does not throw when request has no cookie', async () => {
      const req = new NextRequest(PASS_THROUGH_URL, { headers: {} });
      const res = await middleware(req);
      expect(res.status).toBe(200);
    });

    it('runs successfully when request has cookie header', async () => {
      const req = new NextRequest(PASS_THROUGH_URL, {
        headers: { cookie: 'sb-access-token=abc; path=/' },
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
