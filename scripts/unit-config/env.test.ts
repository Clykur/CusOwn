/**
 * Unit tests: config/env
 * Verifies config loads correctly, env overrides defaults, invalid values are handled.
 * Uses vi.resetModules() + process.env + dynamic import so env is re-parsed per test.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

const envKeys = [
  'NODE_ENV',
  'NEXT_PHASE',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_APP_URL',
  'BOOKING_EXPIRY_HOURS',
  'FEATURE_PAYMENT_CANARY',
  'FEATURE_RESCHEDULE',
  'FEATURE_NO_SHOW',
  'SIGNED_URL_TTL_SECONDS',
  'MEDIA_STRIP_EXIF',
  'AUTO_REFUND_ON_LATE_SUCCESS',
  'SALON_TOKEN_SECRET',
  'CRON_SECRET',
] as const;

function saveEnv(): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const key of envKeys) {
    out[key] = process.env[key];
  }
  return out;
}

function restoreEnv(saved: Record<string, string | undefined>): void {
  for (const key of envKeys) {
    if (saved[key] !== undefined) {
      process.env[key] = saved[key];
    } else {
      delete process.env[key];
    }
  }
}

/** Minimal env that passes schema parse (all required have defaults). */
function setBaselineEnv(): void {
  process.env.NODE_ENV = 'test';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role';
  process.env.SALON_TOKEN_SECRET = 'test-salon-token-secret-32chars-min!'; // pragma: allowlist secret
  process.env.CRON_SECRET = 'test-cron-secret-for-env-tests-16+'; // pragma: allowlist secret
  process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
}

describe('config/env', () => {
  let savedEnv: Record<string, string | undefined>;

  beforeEach(() => {
    vi.resetModules();
    savedEnv = saveEnv();
  });

  afterEach(() => {
    restoreEnv(savedEnv);
  });

  describe('configuration values load correctly', () => {
    it('loads env with baseline and returns expected shape', async () => {
      setBaselineEnv();
      const { env } = await import('@/config/env');
      expect(env.nodeEnv).toBe('test');
      expect(env.supabase.url).toBe('https://test.supabase.co');
      expect(env.supabase.anonKey).toBe('test-anon');
      expect(env.supabase.serviceRoleKey).toBe('test-service-role');
      expect(env.app.baseUrl).toBeDefined();
      expect(env.booking).toBeDefined();
      expect(env.payment).toBeDefined();
      expect(env.featureFlags).toBeDefined();
      expect(env.security).toBeDefined();
      expect(env.media).toBeDefined();
      expect(env.upload).toBeDefined();
    });

    it('parses numeric config from string env', async () => {
      setBaselineEnv();
      process.env.BOOKING_EXPIRY_HOURS = '48';
      process.env.SIGNED_URL_TTL_SECONDS = '3600';
      const { env } = await import('@/config/env');
      expect(env.booking.expiryHours).toBe(48);
      expect(env.security.signedUrlTtlSeconds).toBe(3600);
    });

    it('parses boolean-like config from string env', async () => {
      setBaselineEnv();
      process.env.MEDIA_STRIP_EXIF = 'true';
      process.env.AUTO_REFUND_ON_LATE_SUCCESS = 'true';
      const { env } = await import('@/config/env');
      expect(env.media.stripExif).toBe(true);
      expect(env.payment.autoRefundOnLateSuccess).toBe(true);
    });
  });

  describe('environment variables override defaults', () => {
    it('booking expiry hours uses env when provided', async () => {
      setBaselineEnv();
      process.env.BOOKING_EXPIRY_HOURS = '72';
      const { env } = await import('@/config/env');
      expect(env.booking.expiryHours).toBe(72);
    });

    it('app baseUrl uses env when provided', async () => {
      setBaselineEnv();
      process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com';
      const { env } = await import('@/config/env');
      expect(env.app.baseUrl).toBe('https://app.example.com');
    });

    it('upload storage bucket uses env when provided', async () => {
      setBaselineEnv();
      process.env.UPLOAD_STORAGE_BUCKET = 'custom-bucket';
      const { env } = await import('@/config/env');
      expect(env.upload.storageBucket).toBe('custom-bucket');
    });
  });

  describe('default values when environment variables missing', () => {
    it('booking expiry hours defaults to 24 when unset', async () => {
      setBaselineEnv();
      delete process.env.BOOKING_EXPIRY_HOURS;
      const { env } = await import('@/config/env');
      expect(env.booking.expiryHours).toBe(24);
    });

    it('feature flags default to true when unset', async () => {
      setBaselineEnv();
      delete process.env.FEATURE_PAYMENT_CANARY;
      delete process.env.FEATURE_RESCHEDULE;
      delete process.env.FEATURE_NO_SHOW;
      const { env } = await import('@/config/env');
      expect(env.featureFlags.paymentCanary).toBe(true);
      expect(env.featureFlags.reschedule).toBe(true);
      expect(env.featureFlags.noShow).toBe(true);
    });

    it('signedUrlTtlSeconds defaults to 86400 when unset', async () => {
      setBaselineEnv();
      delete process.env.SIGNED_URL_TTL_SECONDS;
      const { env } = await import('@/config/env');
      expect(env.security.signedUrlTtlSeconds).toBe(86400);
    });
  });

  describe('invalid configuration values are handled safely', () => {
    it('throws when NEXT_PUBLIC_APP_URL is invalid URL', async () => {
      setBaselineEnv();
      process.env.NEXT_PUBLIC_APP_URL = 'not-a-valid-url';
      await expect(import('@/config/env')).rejects.toThrow();
    });

    it('applies dev fallback when Supabase URL is empty in non-production', async () => {
      setBaselineEnv();
      process.env.NEXT_PUBLIC_SUPABASE_URL = '';
      const { env } = await import('@/config/env');
      expect(env.supabase.url).toContain('placeholder');
    });

    it('throws when NEXT_PUBLIC_SUPABASE_URL is empty in production', async () => {
      setBaselineEnv();
      process.env.NODE_ENV = 'production';
      process.env.NEXT_PUBLIC_SUPABASE_URL = '';
      await expect(import('@/config/env')).rejects.toThrow();
    });

    it('throws when Supabase URL is a placeholder host in production', async () => {
      setBaselineEnv();
      process.env.NODE_ENV = 'production';
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://placeholder.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'a'.repeat(120);
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'b'.repeat(120);
      await expect(import('@/config/env')).rejects.toThrow();
    });

    it('throws when SALON_TOKEN_SECRET is missing in production', async () => {
      setBaselineEnv();
      process.env.NODE_ENV = 'production';
      delete process.env.SALON_TOKEN_SECRET;
      await expect(import('@/config/env')).rejects.toThrow();
    });

    it('throws when CRON_SECRET is missing in production', async () => {
      setBaselineEnv();
      process.env.NODE_ENV = 'production';
      delete process.env.CRON_SECRET;
      await expect(import('@/config/env')).rejects.toThrow();
    });
  });

  describe('feature flags from env', () => {
    it('feature flag false when env is "false"', async () => {
      setBaselineEnv();
      process.env.FEATURE_PAYMENT_CANARY = 'false';
      const { env } = await import('@/config/env');
      expect(env.featureFlags.paymentCanary).toBe(false);
    });

    it('feature flag true when env is "true"', async () => {
      setBaselineEnv();
      process.env.FEATURE_RESCHEDULE = 'true';
      const { env } = await import('@/config/env');
      expect(env.featureFlags.reschedule).toBe(true);
    });

    it('feature flag true when env is any non-false string', async () => {
      setBaselineEnv();
      process.env.FEATURE_NO_SHOW = '1';
      const { env } = await import('@/config/env');
      expect(env.featureFlags.noShow).toBe(true);
    });
  });

  describe('validateEnv', () => {
    it('does not throw when required vars are set in test', async () => {
      setBaselineEnv();
      const { validateEnv } = await import('@/config/env');
      expect(() => validateEnv()).not.toThrow();
    });

    it('rejects module load in production when anon key contains template marker', async () => {
      setBaselineEnv();
      process.env.NODE_ENV = 'production';
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abc.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'your-anon-key-replace-me';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'c'.repeat(120);
      await expect(import('@/config/env')).rejects.toThrow(/placeholder or template/i);
    });

    it('validateEnv passes in production when Supabase env is valid', async () => {
      setBaselineEnv();
      process.env.NODE_ENV = 'production';
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abc.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'x'.repeat(180);
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'y'.repeat(180);
      const { validateEnv } = await import('@/config/env');
      expect(() => validateEnv()).not.toThrow();
    });

    it('parses without CRON_SECRET or SALON_TOKEN_SECRET during Next production build phase', async () => {
      setBaselineEnv();
      process.env.NODE_ENV = 'production';
      process.env.NEXT_PHASE = 'phase-production-build';
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abc.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'x'.repeat(180);
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'y'.repeat(180);
      delete process.env.CRON_SECRET;
      delete process.env.SALON_TOKEN_SECRET;
      const { env, validateEnv } = await import('@/config/env');
      expect(env.cron.secret).toBe('');
      expect(env.security.salonTokenSecret.length).toBeGreaterThan(0);
      expect(() => validateEnv()).not.toThrow();
    });
  });
});
