import { z } from 'zod';

const optionalUrl = z
  .string()
  .optional()
  .transform((val) => (val === '' || val === undefined ? undefined : val))
  .pipe(z.string().url().optional());

/** Dev fallbacks when Supabase vars are unset (non-production only). */
const DEV_SUPABASE_URL = 'https://placeholder.supabase.co';
const DEV_SUPABASE_ANON_KEY = 'placeholder-anon-key';
const DEV_SUPABASE_SERVICE_ROLE_KEY = 'placeholder-service-role-key';
/** Dev-only fallback for SALON_TOKEN_SECRET; never used when NODE_ENV is production. */
const DEV_SALON_TOKEN_FALLBACK = 'dev-salon-token-secret-not-for-production';

/** Warn if production secret is shorter than this (aligns with scripts/infrastructure/validate-env.sh). */
const SALON_TOKEN_SECRET_WARN_MIN_LEN = 32;
const CRON_SECRET_WARN_MIN_LEN = 16;

/**
 * Substrings that indicate template / example env values (case-insensitive).
 * Production must not use these.
 */
const PLACEHOLDER_MARKERS = [
  'placeholder',
  'your-project-id',
  'your-anon-key',
  'your-service-role',
  'your-cron-secret',
  'your-random-secret',
  'changeme',
] as const;

const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';
/** True in Node/Edge server; false in browser bundles (evaluated at runtime per chunk). */
const IS_SERVER_BUNDLE = typeof window === 'undefined';

function trimmedOrUndefined(raw: unknown): string | undefined {
  if (raw === undefined || raw === null) return undefined;
  const s = String(raw).trim();
  return s === '' ? undefined : s;
}

/** True if value looks like a template or fake secret (case-insensitive). */
export function looksLikePlaceholderEnvValue(value: string): boolean {
  const v = value.toLowerCase();
  return PLACEHOLDER_MARKERS.some((marker) => v.includes(marker));
}

/** In dev, ensure localhost has port 3000 so redirects (e.g. sign-out) work. */
function normalizeAppBaseUrl(url: string): string {
  if (process.env.NODE_ENV !== 'development') return url;
  try {
    const u = new URL(url);
    if ((u.hostname === 'localhost' || u.hostname === '127.0.0.1') && !u.port) {
      u.port = '3000';
      return u.toString().replace(/\/?$/, '/');
    }
  } catch {
    // ignore
  }
  return url;
}

/** Public URL: required in production; dev/test may omit and get a warned fallback. */
const nextPublicSupabaseUrlSchema = IS_PRODUCTION
  ? z.preprocess(
      trimmedOrUndefined,
      z.string({ required_error: 'NEXT_PUBLIC_SUPABASE_URL is required in production' }).url()
    )
  : z
      .preprocess(trimmedOrUndefined, z.union([z.string().url(), z.undefined()]))
      .transform((val) => {
        if (val) return val;
        console.warn(
          '[env] NEXT_PUBLIC_SUPABASE_URL is unset; using development placeholder. Set it in .env.local for a real Supabase project.'
        );
        return DEV_SUPABASE_URL;
      });

/** Anon key: required in production; dev/test may omit with warned fallback. */
const nextPublicSupabaseAnonKeySchema = IS_PRODUCTION
  ? z.preprocess(
      trimmedOrUndefined,
      z.string({ required_error: 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required in production' }).min(1)
    )
  : z
      .preprocess(trimmedOrUndefined, z.union([z.string().min(1), z.undefined()]))
      .transform((val) => {
        if (val) return val;
        console.warn(
          '[env] NEXT_PUBLIC_SUPABASE_ANON_KEY is unset; using development placeholder. Set it in .env.local for a real Supabase project.'
        );
        return DEV_SUPABASE_ANON_KEY;
      });

/**
 * Service role is server-only. Client bundles never receive this key; use empty string there.
 * Production server requires a real key. Non-production may use a warned dev fallback.
 */
const supabaseServiceRoleKeySchema =
  IS_PRODUCTION && IS_SERVER_BUNDLE
    ? z.preprocess(
        trimmedOrUndefined,
        z.string({ required_error: 'SUPABASE_SERVICE_ROLE_KEY is required in production' }).min(1)
      )
    : IS_PRODUCTION && !IS_SERVER_BUNDLE
      ? z.unknown().transform(() => '')
      : z
          .preprocess(trimmedOrUndefined, z.union([z.string().min(1), z.undefined()]))
          .transform((val) => {
            if (val) return val;
            console.warn(
              '[env] SUPABASE_SERVICE_ROLE_KEY is unset; using development placeholder. Set it in .env.local for server-side operations.'
            );
            return DEV_SUPABASE_SERVICE_ROLE_KEY;
          });

/**
 * HMAC secret for signed resource URLs, pending-booking cookie, location cookie.
 * Production server: required from env (no CRON_SECRET or hardcoded default).
 * Production client: empty (secret not bundled). Non-production: optional with warned dev fallback.
 */
const salonTokenSecretSchema =
  IS_PRODUCTION && IS_SERVER_BUNDLE
    ? z.preprocess(
        trimmedOrUndefined,
        z.string({ required_error: 'SALON_TOKEN_SECRET is required in production' }).min(1)
      )
    : IS_PRODUCTION && !IS_SERVER_BUNDLE
      ? z.unknown().transform(() => '')
      : z
          .preprocess(trimmedOrUndefined, z.union([z.string().min(1), z.undefined()]))
          .transform((val) => {
            if (val) return val;
            console.warn(
              '[env] SALON_TOKEN_SECRET is unset; using a development-only fallback. Set SALON_TOKEN_SECRET in .env.local — the same value is used to generate and validate signed links and cookies.'
            );
            return DEV_SALON_TOKEN_FALLBACK;
          });

/**
 * Cron HTTP auth (Bearer CRON_SECRET). Production server: required. Client bundle: not exposed.
 * Non-production: optional; empty allows local dev without cron secret (validateCronSecret skips auth).
 */
const cronSecretSchema =
  IS_PRODUCTION && IS_SERVER_BUNDLE
    ? z.preprocess(
        trimmedOrUndefined,
        z.string({ required_error: 'CRON_SECRET is required in production' }).min(1)
      )
    : IS_PRODUCTION && !IS_SERVER_BUNDLE
      ? z.unknown().transform(() => '')
      : z
          .preprocess(trimmedOrUndefined, z.union([z.string().min(1), z.undefined()]))
          .transform((val) => {
            if (val) return val;
            console.warn(
              '[env] CRON_SECRET is unset; /api/cron/* and cron-protected routes accept requests without Bearer auth in development only. Set CRON_SECRET to test cron locally.'
            );
            return '';
          });

const envSchema = z.object({
  NODE_ENV: z.string().default('development'),
  NEXT_PUBLIC_SUPABASE_URL: nextPublicSupabaseUrlSchema,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: nextPublicSupabaseAnonKeySchema,
  SUPABASE_SERVICE_ROLE_KEY: supabaseServiceRoleKeySchema,
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  CRON_SECRET: cronSecretSchema,
  SALON_TOKEN_SECRET: salonTokenSecretSchema,
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  SIGNED_URL_TTL_SECONDS: z.string().default('86400'),
  AUDIT_RETENTION_DAYS: z.string().default('90'),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  EMAIL_SERVICE_URL: z.string().optional(),
  EMAIL_API_KEY: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),
  SLOT_EXPIRY_MINUTES: z.string().default('10'),
  PAYMENT_EXPIRY_MINUTES: z.string().default('10'),
  MAX_PAYMENT_ATTEMPTS: z.string().default('3'),
  AUTO_REFUND_ON_LATE_SUCCESS: z.string().default('false'),
  UPI_MERCHANT_VPA: z.string().optional(),
  UPI_MERCHANT_NAME: z.string().default('CusOwn'),
  UPI_WEBHOOK_SECRET: z.string().optional(),
  BOOKING_EXPIRY_HOURS: z.string().default('24'),
  REMINDER_24H_BEFORE_HOURS: z.string().default('24'),
  REMINDER_2H_BEFORE_HOURS: z.string().default('2'),
  CANCELLATION_MIN_HOURS_BEFORE: z.string().default('2'),
  /** No-show: mark confirmed bookings as no-show this many minutes after slot end (cron). */
  NO_SHOW_AUTO_MARK_MINUTES: z.string().default('30'),
  /** Default max reschedules per booking when business has no override. */
  MAX_RESCHEDULE_COUNT: z.string().default('5'),
  /** Storage bucket for uploads (business + profile images). */
  UPLOAD_STORAGE_BUCKET: z.string().min(1).default('uploads'),
  /** Media: retention days for soft-deleted media before hard purge. */
  MEDIA_RETENTION_DAYS: z.string().default('30'),
  /** Media: signed URL short TTL (seconds) when strict/single-use mode. */
  MEDIA_SIGNED_URL_TTL_SHORT: z.string().default('300'),
  /** Media: enable EXIF strip and recompression on upload. */
  MEDIA_STRIP_EXIF: z.string().default('true'),
  /** Media: enable magic-byte validation (reject MIME mismatch). */
  MEDIA_VALIDATE_MAGIC_BYTES: z.string().default('true'),
  /** BigDataCloud geo APIs: optional key for higher limits / IP lookup when required. */
  BIGDATACLOUD_API_KEY: z.string().optional(),
  /** Nominatim geocoding base URL (optional; fallback from constants). */
  NOMINATIM_URL: optionalUrl,
  /** OSRM routing server URL (optional; when unset, internal graph/fallback is used). */
  OSRM_URL: optionalUrl,
  FEATURE_PAYMENT_CANARY: z.string().default('true'),
  FEATURE_RESCHEDULE: z.string().default('true'),
  FEATURE_NO_SHOW: z.string().default('true'),
  /** Redis URL for caching (optional; caching disabled if not set). */
  REDIS_URL: optionalUrl,
  /** Enable Redis caching (set to 'false' to disable even if REDIS_URL is set). */
  REDIS_ENABLED: z.string().default('true'),
  /** Vercel deployment metadata (auto-populated by Vercel). */
  NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA: z.string().optional(),
  NEXT_PUBLIC_VERCEL_ENV: z.string().optional(),
  NEXT_PUBLIC_VERCEL_URL: z.string().optional(),
});

const rawEnv = envSchema.parse(process.env);

export const env = {
  nodeEnv: rawEnv.NODE_ENV,
  featureFlags: {
    paymentCanary: rawEnv.FEATURE_PAYMENT_CANARY !== 'false',
    reschedule: rawEnv.FEATURE_RESCHEDULE !== 'false',
    noShow: rawEnv.FEATURE_NO_SHOW !== 'false',
  },
  supabase: {
    url: rawEnv.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: rawEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    serviceRoleKey: rawEnv.SUPABASE_SERVICE_ROLE_KEY,
  },
  app: {
    baseUrl: normalizeAppBaseUrl(rawEnv.NEXT_PUBLIC_APP_URL),
  },
  cron: {
    secret: rawEnv.CRON_SECRET,
  },
  security: {
    /** Single source: SALON_TOKEN_SECRET only (see salonTokenSecretSchema). */
    salonTokenSecret: rawEnv.SALON_TOKEN_SECRET,
    razorpayWebhookSecret: rawEnv.RAZORPAY_WEBHOOK_SECRET || '',
    stripeWebhookSecret: rawEnv.STRIPE_WEBHOOK_SECRET || '',
    /** Phase 5: Signed URL TTL (seconds). Tokens cannot escalate privilege (resourceType in HMAC). */
    signedUrlTtlSeconds: parseInt(rawEnv.SIGNED_URL_TTL_SECONDS, 10), // 24h default
  },
  /** Phase 5: Audit retention (days). Logs older than this may be purged per policy. */
  audit: {
    retentionDays: parseInt(rawEnv.AUDIT_RETENTION_DAYS, 10),
  },
  monitoring: {
    sentryDsn: rawEnv.NEXT_PUBLIC_SENTRY_DSN || '',
  },
  email: {
    serviceUrl: rawEnv.EMAIL_SERVICE_URL || '',
    apiKey: rawEnv.EMAIL_API_KEY || '',
  },
  sms: {
    twilioAccountSid: rawEnv.TWILIO_ACCOUNT_SID || '',
    twilioAuthToken: rawEnv.TWILIO_AUTH_TOKEN || '',
    twilioPhoneNumber: rawEnv.TWILIO_PHONE_NUMBER || '',
  },
  payment: {
    slotExpiryMinutes: parseInt(rawEnv.SLOT_EXPIRY_MINUTES, 10),
    paymentExpiryMinutes: parseInt(rawEnv.PAYMENT_EXPIRY_MINUTES, 10),
    maxPaymentAttempts: parseInt(rawEnv.MAX_PAYMENT_ATTEMPTS, 10),
    autoRefundOnLateSuccess: rawEnv.AUTO_REFUND_ON_LATE_SUCCESS === 'true',
    upiMerchantVpa: rawEnv.UPI_MERCHANT_VPA || '',
    upiMerchantName: rawEnv.UPI_MERCHANT_NAME,
    upiWebhookSecret: rawEnv.UPI_WEBHOOK_SECRET || '',
  },
  booking: {
    expiryHours: parseInt(rawEnv.BOOKING_EXPIRY_HOURS, 10),
    reminder24hBeforeHours: parseInt(rawEnv.REMINDER_24H_BEFORE_HOURS, 10),
    reminder2hBeforeHours: parseInt(rawEnv.REMINDER_2H_BEFORE_HOURS, 10),
    cancellationMinHoursBefore: parseInt(rawEnv.CANCELLATION_MIN_HOURS_BEFORE, 10),
    noShowAutoMarkMinutes: parseInt(rawEnv.NO_SHOW_AUTO_MARK_MINUTES, 10),
    maxRescheduleCount: parseInt(rawEnv.MAX_RESCHEDULE_COUNT, 10),
  },
  upload: {
    storageBucket: rawEnv.UPLOAD_STORAGE_BUCKET,
  },
  media: {
    retentionDays: parseInt(rawEnv.MEDIA_RETENTION_DAYS, 10),
    signedUrlTtlShortSeconds: parseInt(rawEnv.MEDIA_SIGNED_URL_TTL_SHORT, 10),
    stripExif: rawEnv.MEDIA_STRIP_EXIF === 'true',
    validateMagicBytes: rawEnv.MEDIA_VALIDATE_MAGIC_BYTES === 'true',
  },
  geo: {
    bigDataCloudApiKey: rawEnv.BIGDATACLOUD_API_KEY || '',
    nominatimUrl: rawEnv.NOMINATIM_URL || '',
    osrmUrl: rawEnv.OSRM_URL || '',
  },
  redis: {
    url: rawEnv.REDIS_URL || '',
    enabled: rawEnv.REDIS_ENABLED !== 'false',
  },
  deployment: {
    gitCommitSha: rawEnv.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || null,
    environment: rawEnv.NEXT_PUBLIC_VERCEL_ENV || null,
    url: rawEnv.NEXT_PUBLIC_VERCEL_URL || null,
  },
  nextPublicVercelGitCommitSha: rawEnv.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || null,
} as const;

function assertValidProductionSupabaseEnv(): void {
  const pairs: { key: string; value: string }[] = [
    { key: 'NEXT_PUBLIC_SUPABASE_URL', value: env.supabase.url },
    { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', value: env.supabase.anonKey },
  ];

  if (IS_SERVER_BUNDLE) {
    pairs.push({ key: 'SUPABASE_SERVICE_ROLE_KEY', value: env.supabase.serviceRoleKey });
  }

  for (const { key, value } of pairs) {
    if (!value?.trim()) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
    if (looksLikePlaceholderEnvValue(value)) {
      throw new Error(
        `Invalid environment variable ${key}: value must not contain placeholder or template patterns (e.g. placeholder, your-project-id, your-anon-key).`
      );
    }
  }
}

function warnDevIfSupabaseLooksLikePlaceholders(): void {
  if (IS_PRODUCTION) return;
  const checks: { key: string; value: string }[] = [
    { key: 'NEXT_PUBLIC_SUPABASE_URL', value: env.supabase.url },
    { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', value: env.supabase.anonKey },
  ];
  if (IS_SERVER_BUNDLE) {
    checks.push({ key: 'SUPABASE_SERVICE_ROLE_KEY', value: env.supabase.serviceRoleKey });
  }
  for (const { key, value } of checks) {
    if (value && looksLikePlaceholderEnvValue(value)) {
      console.warn(
        `[env] ${key} appears to use a template or placeholder; set real values in .env.local for integration against Supabase.`
      );
    }
  }
}

function assertValidProductionSalonTokenSecret(): void {
  const st = env.security.salonTokenSecret?.trim() ?? '';
  if (!st) {
    console.error(
      '[env] SALON_TOKEN_SECRET is required in production for signed booking/owner links and signed cookies. Generate a value with: openssl rand -hex 32'
    );
    throw new Error('Missing SALON_TOKEN_SECRET');
  }
  if (looksLikePlaceholderEnvValue(st)) {
    console.error(
      '[env] SALON_TOKEN_SECRET must not use placeholder or template values; use a long random secret.'
    );
    throw new Error('Invalid SALON_TOKEN_SECRET');
  }
  if (st.length < SALON_TOKEN_SECRET_WARN_MIN_LEN) {
    console.warn(
      `[env] SALON_TOKEN_SECRET is shorter than ${SALON_TOKEN_SECRET_WARN_MIN_LEN} characters; prefer a longer random secret in production.`
    );
  }
}

function assertValidProductionCronSecret(): void {
  const s = env.cron.secret?.trim() ?? '';
  if (!s) {
    console.error(
      '[env] CRON_SECRET is required in production. Cron and booking-expiry endpoints require Authorization: Bearer <CRON_SECRET>. Set CRON_SECRET in your host environment (e.g. Vercel project settings).'
    );
    throw new Error('Missing CRON_SECRET');
  }
  if (looksLikePlaceholderEnvValue(s)) {
    console.error(
      '[env] CRON_SECRET must not use placeholder or template values; use a long random secret.'
    );
    throw new Error('Invalid CRON_SECRET');
  }
  if (s.length < CRON_SECRET_WARN_MIN_LEN) {
    console.warn(
      `[env] CRON_SECRET is shorter than ${CRON_SECRET_WARN_MIN_LEN} characters; prefer a longer random secret in production.`
    );
  }
}

function assertValidProductionServerEnv(): void {
  assertValidProductionSupabaseEnv();
  assertValidProductionSalonTokenSecret();
  assertValidProductionCronSecret();
}

if (IS_PRODUCTION && IS_SERVER_BUNDLE) {
  assertValidProductionServerEnv();
}

/** Check if Supabase is properly configured (not using placeholder values). */
export function isSupabaseConfigured(): boolean {
  const url = env.supabase.url;
  const anonKey = env.supabase.anonKey;
  if (!url || !anonKey) return false;
  if (looksLikePlaceholderEnvValue(url) || looksLikePlaceholderEnvValue(anonKey)) return false;
  return true;
}

/**
 * Validates environment. Production server: throws on missing or placeholder Supabase, SALON_TOKEN_SECRET, CRON_SECRET.
 * Non-production: logs warnings only. Browser: no-op (service role is not available client-side).
 */
export function validateEnv(): void {
  if (!IS_SERVER_BUNDLE) {
    return;
  }
  if (!IS_PRODUCTION) {
    warnDevIfSupabaseLooksLikePlaceholders();
    return;
  }
  assertValidProductionServerEnv();
}
