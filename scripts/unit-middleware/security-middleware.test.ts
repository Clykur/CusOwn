/**
 * Unit tests: lib/security/security-middleware
 * Verifies request interception, exempt paths skip CSRF, and token bucket applied.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { securityMiddleware, sanitizeRequest } from '@/lib/security/security-middleware';

const mockTokenBucketRateLimit = vi.fn().mockResolvedValue(null);
const mockCsrfProtection = vi.fn().mockResolvedValue(null);
const mockSanitizeRequestBody = vi.fn().mockResolvedValue({});

vi.mock('@/lib/security/token-bucket-rate-limit.security', () => ({
  tokenBucketRateLimit: (...args: unknown[]) => mockTokenBucketRateLimit(...args),
}));

vi.mock('@/lib/security/csrf', () => ({
  csrfProtection: (...args: unknown[]) => mockCsrfProtection(...args),
}));

vi.mock('@/lib/security/input-sanitizer', () => ({
  sanitizeRequestBody: (...args: unknown[]) => mockSanitizeRequestBody(...args),
}));

describe('security-middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTokenBucketRateLimit.mockResolvedValue(null);
    mockCsrfProtection.mockResolvedValue(null);
  });

  describe('securityMiddleware', () => {
    it('returns null for non-API path', async () => {
      const req = new NextRequest('http://localhost/dashboard', { method: 'GET' });
      const res = await securityMiddleware(req);
      expect(res).toBeNull();
      expect(mockTokenBucketRateLimit).not.toHaveBeenCalled();
    });

    it('calls tokenBucketRateLimit for API path', async () => {
      const req = new NextRequest('http://localhost/api/health', { method: 'GET' });
      await securityMiddleware(req);
      expect(mockTokenBucketRateLimit).toHaveBeenCalledWith(req);
    });

    it('returns token bucket response when rate limited', async () => {
      const rateLimitRes = new Response(JSON.stringify({ error: 'Too many requests' }), {
        status: 429,
      });
      mockTokenBucketRateLimit.mockResolvedValue(rateLimitRes);
      const req = new NextRequest('http://localhost/api/bookings', { method: 'POST' });
      const res = await securityMiddleware(req);
      expect(res).toBe(rateLimitRes);
      expect(mockCsrfProtection).not.toHaveBeenCalled();
    });

    it('skips CSRF for exempt path /api/bookings', async () => {
      const req = new NextRequest('http://localhost/api/bookings', { method: 'POST' });
      const res = await securityMiddleware(req);
      expect(res).toBeNull();
      expect(mockCsrfProtection).not.toHaveBeenCalled();
    });

    it('skips CSRF for exempt path /api/cron/health-check', async () => {
      const req = new NextRequest('http://localhost/api/cron/health-check', { method: 'GET' });
      await securityMiddleware(req);
      expect(mockCsrfProtection).not.toHaveBeenCalled();
    });

    it('calls csrfProtection for non-exempt API path', async () => {
      const req = new NextRequest('http://localhost/api/admin/users', { method: 'GET' });
      await securityMiddleware(req);
      expect(mockCsrfProtection).toHaveBeenCalledWith(req);
    });
  });

  describe('sanitizeRequest', () => {
    it('returns null for GET request', async () => {
      const req = new NextRequest('http://localhost/api/test', { method: 'GET' });
      const out = await sanitizeRequest(req);
      expect(out).toBeNull();
      expect(mockSanitizeRequestBody).not.toHaveBeenCalled();
    });

    it('returns sanitized body for POST request', async () => {
      const body = { name: 'test' };
      mockSanitizeRequestBody.mockResolvedValue(body);
      const req = new NextRequest('http://localhost/api/test', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const out = await sanitizeRequest(req);
      expect(out).toEqual(body);
    });
  });
});
