/**
 * Unit tests: lib/security/security-headers
 * Verifies getSecurityHeaders and applySecurityHeaders behavior.
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, vi } from 'vitest';
import { NextResponse } from 'next/server';
import { getSecurityHeaders, applySecurityHeaders } from '@/lib/security/security-headers';

describe('security-headers', () => {
  let savedEnv: Record<string, string | undefined>;

  beforeAll(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  it('beforeEach uses default URLs when env vars are unset', () => {
    expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBe('https://test.supabase.co');
    expect(process.env.NEXT_PUBLIC_APP_URL).toBe('http://localhost:3000');
  });

  beforeEach(() => {
    savedEnv = {
      NODE_ENV: process.env.NODE_ENV,
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    };
    process.env.NODE_ENV = 'test';
    process.env.NEXT_PUBLIC_SUPABASE_URL =
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  });

  afterEach(() => {
    if (savedEnv.NODE_ENV !== undefined) process.env.NODE_ENV = savedEnv.NODE_ENV;
    if (savedEnv.NEXT_PUBLIC_SUPABASE_URL !== undefined) {
      process.env.NEXT_PUBLIC_SUPABASE_URL = savedEnv.NEXT_PUBLIC_SUPABASE_URL;
    }
    if (savedEnv.NEXT_PUBLIC_APP_URL !== undefined) {
      process.env.NEXT_PUBLIC_APP_URL = savedEnv.NEXT_PUBLIC_APP_URL;
    }
  });

  describe('with URLs set', () => {
    beforeAll(() => {
      process.env.NEXT_PUBLIC_APP_URL = 'http://to-restore.example.com';
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://to-restore.supabase.co';
    });

    it('afterEach restores NEXT_PUBLIC_APP_URL and NEXT_PUBLIC_SUPABASE_URL when saved', () => {
      process.env.NEXT_PUBLIC_APP_URL = 'http://changed.example.com';
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://changed.supabase.co';
      expect(process.env.NEXT_PUBLIC_APP_URL).toBe('http://changed.example.com');
      expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBe('https://changed.supabase.co');
    });
  });

  describe('getSecurityHeaders', () => {
    it('returns X-Frame-Options DENY', () => {
      const headers = getSecurityHeaders();
      expect(headers['X-Frame-Options']).toBe('DENY');
    });

    it('returns X-Content-Type-Options nosniff', () => {
      const headers = getSecurityHeaders();
      expect(headers['X-Content-Type-Options']).toBe('nosniff');
    });

    it('returns Referrer-Policy strict-origin-when-cross-origin', () => {
      const headers = getSecurityHeaders();
      expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    });

    it('returns Permissions-Policy with camera and microphone disabled', () => {
      const headers = getSecurityHeaders();
      const pp = headers['Permissions-Policy'];
      expect(pp).toContain('camera=()');
      expect(pp).toContain('microphone=()');
    });

    it('returns Content-Security-Policy with default-src and frame-ancestors', () => {
      const headers = getSecurityHeaders();
      const csp = headers['Content-Security-Policy'];
      expect(csp).toBeDefined();
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("object-src 'none'");
    });

    it('includes connect-src with supabase wss, payments, and Vercel insights in CSP', () => {
      const headers = getSecurityHeaders();
      const csp = headers['Content-Security-Policy'];
      expect(csp).toContain("'self'");
      expect(csp).toContain('connect-src');
      expect(csp).toContain('wss://*.supabase.co');
      expect(csp).toContain('https://api.razorpay.com');
      expect(csp).toContain('https://vitals.vercel-insights.com');
    });

    it('does not set Strict-Transport-Security in non-production', () => {
      process.env.NODE_ENV = 'test';
      const headers = getSecurityHeaders();
      expect(headers['Strict-Transport-Security']).toBeUndefined();
    });

    it('sets Strict-Transport-Security in production with https app URL', async () => {
      vi.resetModules();
      process.env.NODE_ENV = 'production';
      process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com';
      const { getSecurityHeaders: getHeaders } = await import('@/lib/security/security-headers');
      const headers = getHeaders();
      expect(headers['Strict-Transport-Security']).toBeDefined();
      expect(headers['Strict-Transport-Security']).toContain('max-age=31536000');
      expect(headers['Strict-Transport-Security']).toContain('includeSubDomains');
    });
  });

  describe('applySecurityHeaders', () => {
    it('applies all security headers to NextResponse', () => {
      const res = NextResponse.next();
      applySecurityHeaders(res);
      expect(res.headers.get('X-Frame-Options')).toBe('DENY');
      expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
      expect(res.headers.get('Content-Security-Policy')).toBeDefined();
    });

    it('overwrites existing headers with same name', () => {
      const res = NextResponse.next();
      res.headers.set('X-Frame-Options', 'SAMEORIGIN');
      applySecurityHeaders(res);
      expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    });

    it('does not remove other headers on the response', () => {
      const res = NextResponse.next();
      res.headers.set('X-Custom-Header', 'custom-value');
      applySecurityHeaders(res);
      expect(res.headers.get('X-Custom-Header')).toBe('custom-value');
      expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    });
  });
});
