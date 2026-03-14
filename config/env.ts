import { z } from 'zod';

const optionalUrl = z
  .string()
  .optional()
  .transform((val) => (val === '' || val === undefined ? undefined : val))
  .pipe(z.string().url().optional());

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

const envSchema = z.object({
  NODE_ENV: z.string().default('development'),
  NEXT_PUBLIC_SUPABASE_URL: z.string().min(1).default('https://placeholder.supabase.co'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).default('placeholder-anon-key'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).default('placeholder-service-role-key'),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  CRON_SECRET: z.string().optional(),
  SALON_TOKEN_SECRET: z.string().optional(),
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
    secret: rawEnv.CRON_SECRET || '',
  },
  security: {
    get salonTokenSecret(): string {
      return (
        process.env.SALON_TOKEN_SECRET ||
        process.env.CRON_SECRET ||
        'default-secret-change-in-production'
      );
    },
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

/** Check if Supabase is properly configured (not using placeholder values). */
export function isSupabaseConfigured(): boolean {
  const url = env.supabase.url;
  const anonKey = env.supabase.anonKey;
  if (!url || !anonKey) return false;
  if (url.includes('placeholder') || anonKey.includes('placeholder')) return false;
  return true;
}

export const validateEnv = (): void => {
  const required = [
    { key: 'NEXT_PUBLIC_SUPABASE_URL', value: env.supabase.url },
    { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', value: env.supabase.anonKey },
    { key: 'SUPABASE_SERVICE_ROLE_KEY', value: env.supabase.serviceRoleKey },
  ];

  const missing = required.filter(({ value }) => !value);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.map(({ key }) => key).join(', ')}`
    );
  }
};
