export const SLOT_DURATIONS = [15, 30, 45, 60] as const;

export const BOOKING_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
} as const;

export const SLOT_STATUS = {
  AVAILABLE: 'available',
  RESERVED: 'reserved',
  BOOKED: 'booked',
} as const;

export const DEFAULT_SLOT_DURATION = 30;

// Generate slots for 7 days initially (matches lazy generation window)
export const DAYS_TO_GENERATE_SLOTS = 7;

import { env } from './env';

export const SLOT_RESERVATION_TIMEOUT_MINUTES = env.payment.slotExpiryMinutes;

// Number of days ahead to generate slots when lazy loading
export const SLOT_GENERATION_WINDOW_DAYS = 7;

export const BOOKING_LINK_PREFIX = '/b/';

export const API_ROUTES = {
  SALONS: '/api/salons',
  SLOTS: '/api/slots',
  BOOKINGS: '/api/bookings',
} as const;

export const ROUTES = {
  HOME: '/',
  SETUP: '/setup',
  BOOKING: '/b',
  ACCEPT: '/accept',
  REJECT: '/reject',
  DASHBOARD: '/dashboard',
} as const;

export const WHATSAPP_MESSAGE_TEMPLATES = {
  BOOKING_REQUEST: (customerName: string, date: string, time: string, bookingId: string) =>
    `📅 *NEW BOOKING REQUEST*\n\n` +
    `Hello! I would like to book an appointment.\n\n` +
    `*Customer Details:*\n` +
    `Name: *${customerName}*\n\n` +
    `*Appointment Details:*\n` +
    `📆 Date: *${date}*\n` +
    `🕐 Time: *${time}*\n\n` +
    `Booking ID: \`${bookingId}\``,
  CONFIRMATION: (
    customerName: string,
    date: string,
    time: string,
    salonName: string,
    address: string,
    mapsLink: string
  ) =>
    `✅ *APPOINTMENT CONFIRMED*\n\n` +
    `Dear *${customerName}*,\n\n` +
    `Your appointment has been confirmed!\n\n` +
    `*Appointment Details:*\n` +
    `📆 Date: *${date}*\n` +
    `🕐 Time: *${time}*\n` +
    `🏢 Salon: *${salonName}*\n\n` +
    `*Location:*\n` +
    `📍 ${address}\n\n` +
    `🗺️ *Get Directions:*\n` +
    `${mapsLink}\n\n` +
    `We look forward to seeing you!\n` +
    `Thank you! 🙏`,
  REJECTION: (customerName: string, bookingLink: string) =>
    `❌ *SLOT UNAVAILABLE*\n\n` +
    `Dear *${customerName}*,\n\n` +
    `We apologize, but the requested time slot is not available.\n\n` +
    `Please select another time slot from our available options:\n\n` +
    `🔗 *Book New Slot:*\n` +
    `${bookingLink}\n\n` +
    `Thank you for your understanding.`,
} as const;

export const VALIDATION = {
  WHATSAPP_NUMBER_MIN_LENGTH: 10,
  WHATSAPP_NUMBER_MAX_LENGTH: 15,
  SALON_NAME_MIN_LENGTH: 2,
  SALON_NAME_MAX_LENGTH: 100,
  OWNER_NAME_MIN_LENGTH: 2,
  OWNER_NAME_MAX_LENGTH: 100,
  ADDRESS_MIN_LENGTH: 5,
  ADDRESS_MAX_LENGTH: 500,
} as const;

export const ERROR_MESSAGES = {
  SALON_NAME_REQUIRED: 'Salon name is required',
  SALON_NAME_INVALID: `Salon name must be between ${VALIDATION.SALON_NAME_MIN_LENGTH} and ${VALIDATION.SALON_NAME_MAX_LENGTH} characters`,
  OWNER_NAME_REQUIRED: 'Owner name is required',
  OWNER_NAME_INVALID: `Owner name must be between ${VALIDATION.OWNER_NAME_MIN_LENGTH} and ${VALIDATION.OWNER_NAME_MAX_LENGTH} characters`,
  WHATSAPP_NUMBER_REQUIRED: 'WhatsApp number is required',
  WHATSAPP_NUMBER_INVALID: 'Invalid WhatsApp number format',
  ADDRESS_REQUIRED: 'Address is required',
  ADDRESS_INVALID: `Address must be between ${VALIDATION.ADDRESS_MIN_LENGTH} and ${VALIDATION.ADDRESS_MAX_LENGTH} characters`,
  OPENING_TIME_REQUIRED: 'Opening time is required',
  CLOSING_TIME_REQUIRED: 'Closing time is required',
  SLOT_DURATION_REQUIRED: 'Slot duration is required',
  SLOT_DURATION_INVALID: 'Invalid slot duration',
  TIME_INVALID: 'Closing time must be after opening time',
  SALON_NOT_FOUND: 'Salon not found',
  BOOKING_LINK_EXISTS: 'Booking link already exists. Please try a different salon name',
  SLOT_GENERATION_FAILED: 'Failed to generate slots',
  DATABASE_ERROR: 'Database error occurred',
  SLOT_NOT_FOUND: 'Slot not found',
  SLOT_NOT_AVAILABLE: 'This slot is no longer available',
  BOOKING_NOT_FOUND: 'Booking not found',
  CUSTOMER_NAME_REQUIRED: 'Customer name is required',
  CUSTOMER_PHONE_REQUIRED: 'Customer phone number is required',
  CUSTOMER_PHONE_INVALID: 'Invalid phone number format',
  BOOKING_ID_REQUIRED: 'Booking ID is required',
  WHATSAPP_SEND_FAILED: 'Failed to send WhatsApp message',
  WHATSAPP_NUMBER_EXISTS:
    'This WhatsApp number is already registered. Please use a different number or contact support if this is your number.',
  QR_CODE_GENERATION_FAILED:
    'Unable to generate QR code. You can access it later from your dashboard.',
  NETWORK_ERROR:
    'Unable to connect to the server. Please check your internet connection and try again.',
  UNEXPECTED_ERROR: 'An unexpected error occurred. Please try again.',
  LOADING_ERROR: 'Failed to load data. Please refresh the page and try again.',
  BOOKING_CANNOT_BE_CANCELLED: 'This booking cannot be cancelled',
  BOOKING_ALREADY_CANCELLED: 'This booking is already cancelled',
  BOOKING_ALREADY_CONFIRMED: 'Booking already confirmed',
  BOOKING_ALREADY_REJECTED: 'Booking already rejected',
  CANCELLATION_TOO_LATE: 'Cancellation must be at least 2 hours before appointment',
  DOWNTIME_DATE_INVALID: 'Invalid date range for closure',
  REMINDER_NOT_FOUND: 'Reminder not found',
  REMINDER_ALREADY_SENT: 'Reminder already sent',
  RATE_LIMIT_EXCEEDED: 'Too many requests. Please try again later.',
  UNAUTHORIZED: 'Unauthorized',
  IDEMPOTENCY_KEY_REQUIRED: 'Idempotency key required: send x-idempotency-key header',
  USER_BLOCK_FAILED: 'Failed to block user',
  USER_UNBLOCK_FAILED: 'Failed to unblock user',
  USER_DELETE_FAILED: 'Failed to delete user',
  CANNOT_DELETE_SELF: 'You cannot delete your own account',
} as const;

export const SUCCESS_MESSAGES = {
  SALON_CREATED: 'Salon created successfully',
  SLOTS_GENERATED: 'Slots generated successfully',
  SLOT_RESERVED: 'Slot reserved successfully',
  SLOT_RELEASED: 'Slot released successfully',
  BOOKING_CREATED: 'Booking created successfully',
  BOOKING_CONFIRMED: 'Booking confirmed successfully',
  BOOKING_REJECTED: 'Booking rejected successfully',
  BOOKING_CANCELLED: 'Booking cancelled successfully',
  REMINDER_SENT: 'Reminder sent successfully',
  USER_BLOCKED: 'User blocked successfully',
  USER_UNBLOCKED: 'User unblocked successfully',
  USER_DELETED: 'User deleted successfully',
} as const;

/** Phase 6: Explicit UI state messages for each backend booking state. Use these so UX reflects backend truth. */
export const UI_BOOKING_STATE = {
  PENDING: 'Waiting for confirmation',
  CONFIRMED: 'Your appointment is confirmed!',
  REJECTED: 'This slot is not available',
  CANCELLED: 'This booking has been cancelled',
  /** When status is cancelled and cancelled_by === 'system' (expired). */
  EXPIRED: 'This request has expired',
} as const;

/** Phase 6: Idempotent success copy (e.g. user clicked Accept again on already-confirmed booking). */
export const UI_IDEMPOTENT = {
  ALREADY_CONFIRMED: 'This booking is already confirmed.',
  ALREADY_REJECTED: 'This booking was already declined.',
} as const;

/** UI behavior hardening: context and clarity copy (no visual redesign). */
export const UI_CONTEXT = {
  SECURE_ACTION_LINK: 'You are viewing a secure one-time booking action link.',
  GO_TO_OWNER_DASHBOARD: 'Go to owner dashboard to manage more bookings',
  BOOKING_STATUS_SINGLE: 'This page shows a single booking.',
  DASHBOARD_PURPOSE: 'Booking history and overview.',
  DEPRECATED_DASHBOARD: 'This dashboard is deprecated. Redirecting…',
  ROOT_CHECKING_ACCOUNT: 'Checking your account…',
  ADMIN_CONSOLE: 'Admin Console',
  YOU_ARE_IN_ADMIN_MODE: 'You are in admin mode',
  VIEWING_AS_CUSTOMER: 'Viewing as: Customer',
  VIEWING_AS_OWNER: 'Viewing as: Owner',
  VIEWING_AS_ADMIN: 'Viewing as: Admin',
  ROLE_OWNER_HELPER: 'Manages a business and receives bookings.',
  ROLE_CUSTOMER_HELPER: 'Books services.',
  ROLE_BOTH_HELPER: 'Does both.',
} as const;

/** Contextual error messages (no internal details). */
export const UI_ERROR_CONTEXT = {
  BOOKING_PAGE: 'This slot may no longer be available.',
  DASHBOARD_PAGE: 'Something went wrong. Try refreshing or return to dashboard.',
  ACCEPT_REJECT_PAGE: 'This link may have expired or already been used.',
  GENERIC: 'Something went wrong. Try again.',
} as const;

export const BOOKING_EXPIRY_HOURS = parseInt(process.env.BOOKING_EXPIRY_HOURS || '24', 10);
export const REMINDER_24H_BEFORE_HOURS = parseInt(
  process.env.REMINDER_24H_BEFORE_HOURS || '24',
  10
);
export const REMINDER_2H_BEFORE_HOURS = parseInt(process.env.REMINDER_2H_BEFORE_HOURS || '2', 10);
export const CANCELLATION_MIN_HOURS_BEFORE = parseInt(
  process.env.CANCELLATION_MIN_HOURS_BEFORE || '2',
  10
);

/** Phase 3: Metric names for SRE. Alert if GET /api/health checks.cron_expire_bookings_last_run_ts is older than X minutes. */
export const METRICS_CRON_EXPIRE_BOOKINGS_LAST_RUN = 'cron.expire_bookings.last_run_ts';
export const METRICS_EXPIRED_BY_CRON = 'bookings.expired_by_cron';
export const METRICS_EXPIRED_BY_LAZY_HEAL = 'bookings.expired_by_lazy_heal';

/** Phase 4: Lifecycle metrics for dashboards (booking funnel, payment success). */
export const METRICS_BOOKING_CREATED = 'booking_created';
export const METRICS_BOOKING_CONFIRMED = 'booking_confirmed';
export const METRICS_BOOKING_REJECTED = 'booking_rejected';
export const METRICS_BOOKING_CANCELLED_USER = 'booking_cancelled_user';
export const METRICS_BOOKING_CANCELLED_SYSTEM = 'booking_cancelled_system';
export const METRICS_PAYMENT_CREATED = 'payment_created';
export const METRICS_PAYMENT_SUCCEEDED = 'payment_succeeded';
export const METRICS_PAYMENT_FAILED = 'payment_failed';

/** Phase 5: Rate limits (security). Booking creation per IP + per user. */
export const RATE_LIMIT_BOOKING_WINDOW_MS = 60_000;
export const RATE_LIMIT_BOOKING_MAX_PER_WINDOW = 10;
/** Phase 5: Admin endpoints — per user + per IP. */
export const RATE_LIMIT_ADMIN_WINDOW_MS = 60_000;
export const RATE_LIMIT_ADMIN_MAX_PER_WINDOW = 100;

/** Phase 5: Refund/cancellation policy (documentation; no product change). */
export const REFUND_POLICY_NOTE = 'Refunds follow payment provider policy and business discretion.';

/** Auth observability: every deny must emit these metrics (auth_denied vs auth_missing vs auth_invalid_token). */
export const METRICS_AUTH_MISSING = 'auth_missing';
export const METRICS_AUTH_DENIED = 'auth_denied';
export const METRICS_AUTH_INVALID_TOKEN = 'auth_invalid_token';

/** Admin analytics: max date range (days) and export row limit. */
export const ADMIN_ANALYTICS_MAX_DAYS = 365;
export const ADMIN_EXPORT_BOOKINGS_MAX_ROWS = 10_000;
export const ADMIN_BUSINESS_HEALTH_DEFAULT_LIMIT = 20;
export const ADMIN_DEFAULT_ANALYTICS_DAYS = 30;

/** Backend performance: cache TTL and API cache size. */
export const CACHE_TTL_AUTH_MS = 5 * 60 * 1000; // 5 min auth verification cache
export const CACHE_TTL_API_DEFAULT_MS = 60 * 1000; // 1 min for mutable GETs
export const CACHE_TTL_API_LONG_MS = 300 * 1000; // 5 min for stable GETs
export const CACHE_STALE_GRACE_MS = 30 * 1000; // Serve stale up to 30s while revalidating (API)
export const API_CACHE_MAX_KEYS = 500;
export const SLOW_REQUEST_MS = 200; // Log and flag requests above this
export const API_PAGINATION_DEFAULT_LIMIT = 25;
export const API_PAGINATION_MAX_LIMIT = 100;

/** Client admin cache: TTL, stale grace, max entries (no hardcoded values in components). */
export const ADMIN_CACHE_TTL_MS = 5 * 60 * 1000; // 5 min
export const ADMIN_CACHE_STALE_GRACE_MS = 10 * 60 * 1000; // 10 min serve stale
export const ADMIN_CACHE_MAX_ENTRIES = 10;

/** Token bucket rate limit: capacity and refill per second. */
export const TOKEN_BUCKET_CAPACITY = 100;
export const TOKEN_BUCKET_REFILL_PER_SEC = 20;
export const TOKEN_BUCKET_ADMIN_CAPACITY = 80;
export const TOKEN_BUCKET_ADMIN_REFILL_PER_SEC = 15;
export const TOKEN_BUCKET_EXPORT_CAPACITY = 10;
export const TOKEN_BUCKET_EXPORT_REFILL_PER_SEC = 1;
/** Auth endpoints (login initiation): stricter to prevent abuse. */
export const TOKEN_BUCKET_AUTH_CAPACITY = 10;
export const TOKEN_BUCKET_AUTH_REFILL_PER_SEC = 0.5;

/** Export: rate limit tier (max date range uses ADMIN_ANALYTICS_MAX_DAYS). */
export const EXPORT_RATE_LIMIT_REQUESTS_PER_MIN = 5;

/** Idempotency: header name and feature flag. */
export const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';
/** Booking create: require this header for idempotent create. */
export const BOOKING_IDEMPOTENCY_HEADER = 'x-idempotency-key';
export const IDEMPOTENCY_ENABLED = true;

/** Client retry: single retry with backoff (ms). */
export const CLIENT_RETRY_BACKOFF_MS = 500;
/** Admin fetch: max number of retries (0 = no retry, 1 = one retry after first attempt). Never unlimited. */
export const ADMIN_FETCH_MAX_RETRIES = 1;

/** Admin session: proactive refresh interval so token stays valid. */
export const ADMIN_SESSION_REFRESH_INTERVAL_MS = 55 * 60 * 1000; // 55 min (before default 1h JWT expiry)
/** Auth cookie max-age (seconds) so admin can stay logged in 24h. Set JWT expiry to 86400 in Supabase Dashboard for 24h. */
export const AUTH_COOKIE_MAX_AGE_SECONDS = 86400; // 24 hours

/** Pending role during OAuth: set on login when ?role=, read/cleared in callback only. Never override admin. */
export const AUTH_PENDING_ROLE_COOKIE = 'cusown_pending_role';
export const AUTH_PENDING_ROLE_MAX_AGE_SECONDS = 300; // 5 min

/** Client: debounce Supabase auth refresh_token requests to avoid 429. */
export const AUTH_REFRESH_DEBOUNCE_MS = 60_000; // 1 min
