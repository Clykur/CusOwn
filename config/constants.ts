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

/** Public booking path for QR; no auth. */
export const BOOKING_LINK_PREFIX = '/book/';

/** Fallback when /api/business-categories is unavailable. Real list comes from DB. */
export const BUSINESS_CATEGORIES_FALLBACK: { value: string; label: string }[] = [
  { value: 'salon', label: 'Salon' },
];

export const API_ROUTES = {
  SALONS: '/api/salons',
  SLOTS: '/api/slots',
  BOOKINGS: '/api/bookings',
  BUSINESS_CATEGORIES: '/api/business-categories',
  /** Public booking: business by slug (no auth, no owner data). */
  BOOK_BUSINESS: (slug: string) => `/api/book/business/${encodeURIComponent(slug)}`,
  /** Store pending booking before redirect to login; read on /book/complete. */
  BOOK_SET_PENDING: '/api/book/set-pending',
  /** Complete pending booking after login (auth required). */
  BOOK_COMPLETE: '/api/book/complete',
  /** Media: profile image upload (owner/customer). */
  MEDIA_PROFILE: '/api/media/profile',
  /** Media: business images (owner). */
  MEDIA_BUSINESS: (businessId: string) => `/api/media/business/${businessId}`,
  /** Media: signed URL for display. */
  MEDIA_SIGNED_URL: '/api/media/signed-url',
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

/** Mobile/phone: exactly 10 digits (no extra digits allowed). */
export const PHONE_DIGITS = 10;

export const VALIDATION = {
  WHATSAPP_NUMBER_MIN_LENGTH: PHONE_DIGITS,
  WHATSAPP_NUMBER_MAX_LENGTH: PHONE_DIGITS,
  SALON_NAME_MIN_LENGTH: 2,
  SALON_NAME_MAX_LENGTH: 100,
  OWNER_NAME_MIN_LENGTH: 2,
  OWNER_NAME_MAX_LENGTH: 100,
  ADDRESS_MIN_LENGTH: 5,
  ADDRESS_MAX_LENGTH: 500,
} as const;

/** Simple email format for input validation (local + @ + domain). */
export const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

export const ERROR_MESSAGES = {
  SALON_NAME_REQUIRED: 'Salon name is required',
  SALON_NAME_INVALID: `Salon name must be between ${VALIDATION.SALON_NAME_MIN_LENGTH} and ${VALIDATION.SALON_NAME_MAX_LENGTH} characters`,
  OWNER_NAME_REQUIRED: 'Owner name is required',
  OWNER_NAME_INVALID: `Owner name must be between ${VALIDATION.OWNER_NAME_MIN_LENGTH} and ${VALIDATION.OWNER_NAME_MAX_LENGTH} characters`,
  WHATSAPP_NUMBER_REQUIRED: 'WhatsApp number is required',
  WHATSAPP_NUMBER_INVALID: `Please enter a valid 10-digit mobile number (${PHONE_DIGITS} digits only)`,
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
  CUSTOMER_PHONE_REQUIRED: 'Please enter your phone number',
  CUSTOMER_PHONE_INVALID: `Please enter a valid 10-digit mobile number (${PHONE_DIGITS} digits only)`,
  EMAIL_INVALID: 'Please enter a valid email address',
  BOOKING_ID_REQUIRED: 'Booking ID is required',
  WHATSAPP_SEND_FAILED: 'Failed to send WhatsApp message',
  WHATSAPP_NUMBER_EXISTS:
    'This WhatsApp number is already registered. Please use a different number or contact support if this is your number.',
  /** Generic message for create-business failures (constraint/DB). Never expose technical or admin details to owner/customer. */
  CREATE_BUSINESS_FAILED: "We couldn't create the business right now. Please try again.",
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
  UNDO_WINDOW_EXPIRED: 'Undo window has expired',
  SLOT_NO_LONGER_AVAILABLE: 'Slot is no longer available; cannot undo reject',
  BOOKING_NOT_CONFIRMED: 'Booking is not confirmed',
  BOOKING_NOT_REJECTED: 'Booking is not rejected',
  BOOKING_REVERT_FAILED: 'Booking could not be reverted',
  UNDO_ALREADY_USED: 'Undo can only be used once per booking',
  MEDIA_FILE_TYPE_INVALID: 'File type is not allowed',
  MEDIA_FILE_TOO_LARGE: 'File size exceeds the maximum allowed',
  MEDIA_UPLOAD_FAILED: 'Upload failed. Please try again.',
  MEDIA_NOT_FOUND: 'Image not found',
  MEDIA_BUSINESS_ACCESS_DENIED: 'You do not have access to this business',
  MEDIA_PROFILE_ACCESS_DENIED: 'You can only update your own profile image',
  MEDIA_BUSINESS_MAX_IMAGES: 'Maximum number of business images reached',
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
  ACCOUNT_DELETED:
    'Your account and associated business data have been removed from the platform. For administrative and recovery purposes, your data will be securely stored for up to 30 days before being permanently deleted.',
  ACCOUNT_RESTORED: 'Account restored successfully',
  BOOKING_REVERTED_TO_PENDING: 'Booking reverted to pending',
  MEDIA_UPLOADED: 'Image uploaded successfully',
  MEDIA_DELETED: 'Image removed successfully',
  PROFILE_IMAGE_UPDATED: 'Profile image updated successfully',
} as const;

/** Phase 6: Explicit UI state messages for each backend booking state. Use these so UX reflects backend truth. */
export const UI_BOOKING_STATE = {
  PENDING: 'Waiting for confirmation',
  CONFIRMED: 'Your appointment is confirmed!',
  REJECTED: 'This slot is not available',
  CANCELLED: 'This booking has been cancelled',
  /** When status is cancelled and cancelled_by === 'system' (expired). */
  EXPIRED: 'This request has expired',
  /** When owner marked as no-show (status remains confirmed). */
  NO_SHOW: 'Marked as no-show — you did not attend this appointment',
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
  VIEWING_AS_CUSTOMER: 'Customer',
  VIEWING_AS_OWNER: 'Owner',
  VIEWING_AS_ADMIN: 'Viewing as: Admin',
  ROLE_OWNER_HELPER: 'Manages a business and receives bookings.',
  ROLE_CUSTOMER_HELPER: 'Books services.',
  ROLE_BOTH_HELPER: 'Does both.',
  /** Shown when user tries to access owner area but this account is not set up as owner. */
  ROLE_ACCESS_DENIED_NOT_OWNER:
    "This account isn't set up as an owner. You can use it as a customer here, or sign in with a different email for the owner flow. One email can be both; you can also use two different emails for the two roles.",
  /** Shown when user tries to access customer area but this account cannot use customer flow. */
  ROLE_ACCESS_DENIED_NOT_CUSTOMER:
    "This account doesn't have customer access. You can continue as owner, or sign in with a different email for the customer flow.",
  /** Owner: undo accept/reject button label. */
  UNDO_LABEL: 'Undo',
  /** Owner: toast after reverting to pending. */
  REVERTED_TO_PENDING: 'Booking reverted to pending',
  /** Owner: status label when customer cancelled after accept. */
  CANCELLED_BY_CUSTOMER: 'Cancelled by customer',
  /** Create business: info when owner reuses a WhatsApp number already used for another business. */
  WHATSAPP_ALREADY_USED_FOR: (businessName: string) =>
    `This number is already used for "${businessName}". You can use it for this business too.`,
} as const;

/** Customer flow UI – generic, multi-service-ready copy. No category names. */
export const UI_CUSTOMER = {
  NAV_MY_ACTIVITY: 'My Activity',
  NAV_EXPLORE_SERVICES: 'Explore Services',
  NAV_PROFILE: 'Profile',
  HEADER_MY_ACTIVITY: 'My Activity',
  HEADER_MY_ACTIVITY_SUB: 'View and manage your appointments',
  HEADER_EXPLORE_SERVICES: 'Explore Services',
  HEADER_EXPLORE_SUB: 'Discover services near you',
  HEADER_BROWSE_SUB: 'Find trusted providers in your area',
  HEADER_PROFILE: 'My Profile',
  HEADER_PROFILE_SUB: 'Manage your account and preferences',
  HEADER_BOOKING_DETAILS: 'Appointment Details',
  HEADER_BOOKING_DETAILS_SUB: 'View your appointment status',
  STAT_TOTAL_APPOINTMENTS: 'Total Appointments',
  STAT_UPCOMING: 'Upcoming',
  STAT_COMPLETED: 'Completed',
  SECTION_APPOINTMENTS: 'Appointments',
  EMPTY_ACTIVITY: "You don't have any appointments yet.",
  CTA_EXPLORE_SERVICES: 'Explore Services',
  DISCOVER_HEADING: 'Discover Services Near You',
  DISCOVER_SUB: 'Choose a service to get started',
  CATEGORY_CTA: 'View Providers',
  SEARCH_PLACEHOLDER: 'Search by name or location',
  RESULTS_COUNT: 'results found',
  RESULT_COUNT: 'result found',
  EMPTY_NO_MATCH: "We couldn't find any matches.",
  EMPTY_TRY_FILTERS: 'Adjust filters or try a different search.',
  CTA_ADJUST_FILTERS: 'Adjust filters',
  PROVIDER_FALLBACK: 'Provider',
  LABEL_BOOKING_ID: 'Appointment ID',
  BREADCRUMB_BACK_EXPLORE: 'Back to Explore Services',
  BOOK_PAGE_SUB: 'Book your appointment',
  BOOKING_SENT_HEADING: 'Booking Request Sent!',
  BOOKING_SENT_ID_LABEL: 'Your booking ID is:',
  BOOKING_SENT_WHATSAPP_HINT:
    'Click the button below to send your booking request to the salon owner on WhatsApp',
  CTA_OPEN_WHATSAPP: 'Open WhatsApp',
  CTA_VIEW_BOOKING_STATUS: 'View Booking Status',
  BOOKING_SENT_CONFIRM_HINT:
    'The salon owner will confirm your appointment and send you a confirmation message',
  LABEL_YOUR_NAME: 'Your Name',
  LABEL_PHONE_NUMBER: 'Phone Number',
  LABEL_SELECT_DATE: 'Select Date',
  LABEL_SELECT_TIME: 'Select Time',
  PLACEHOLDER_NAME: 'John Doe',
  PLACEHOLDER_PHONE: '10 digits',
  SLOT_VERIFYING: 'Verifying...',
  SLOT_FULL: 'Full',
  SUBMIT_BOOKING: 'Send Booking Request',
  SUBMIT_BOOKING_LOADING: 'Creating Booking...',
  /** Shown when unauthenticated user submits; we redirect to login to complete booking. */
  SIGN_IN_TO_COMPLETE_BOOKING: 'Sign in to complete your booking',
  SLOTS_NONE: 'No slots available for this date',
  SLOT_NO_LONGER_AVAILABLE: 'Your selected slot is no longer available. Please select another.',
} as const;

/** Contextual error messages (no internal details). */
export const UI_ERROR_CONTEXT = {
  BOOKING_PAGE: 'This slot may no longer be available.',
  DASHBOARD_PAGE: 'Something went wrong. Try refreshing or return to dashboard.',
  ACCEPT_REJECT_PAGE: 'This link may have expired or already been used.',
  GENERIC: 'Something went wrong. Try again.',
} as const;

/** Booking/reminder/cancellation hours are on env.booking (config/env.ts). */

/** Owner undo: 5 min window. Undo allowed only once per accept/reject and only within this period; after undo or expiry the undo button is hidden. */
export const UNDO_ACCEPT_REJECT_WINDOW_MINUTES = 5;

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
/** Media upload: per user + per IP to prevent abuse. */
export const RATE_LIMIT_MEDIA_UPLOAD_WINDOW_MS = 60_000;
export const RATE_LIMIT_MEDIA_UPLOAD_MAX_PER_WINDOW = 30;

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

/** Admin overview: failed bookings and cron lookback (hours). */
export const ADMIN_OVERVIEW_FAILED_BOOKINGS_HOURS = 24;
export const ADMIN_OVERVIEW_CRON_LOOKBACK_HOURS = 24;

/** Cron run log: status values. */
export const CRON_RUN_STATUS_SUCCESS = 'success';
export const CRON_RUN_STATUS_FAILED = 'failed';

/** Cron job names for run logging (must match route identifiers). */
export const CRON_JOB_NAMES = [
  'expire-bookings',
  'expire-payments',
  'prune-idempotency',
  'cleanup-reservations',
  'send-reminders',
  'trim-metric-timings',
  'health-check',
  'purge-soft-deleted-media',
] as const;
export type CronJobName = (typeof CRON_JOB_NAMES)[number];

/** Auth event types for optional logging. */
export const AUTH_EVENT_LOGIN_SUCCESS = 'login_success';
export const AUTH_EVENT_LOGIN_FAILED = 'login_failed';
export const AUTH_EVENT_LOGOUT = 'logout';

/** Audit: structured action types by domain. Only state-changing or security-relevant events. */
export const AUDIT_ACTIONS = {
  BOOKING: [
    'booking_created',
    'booking_confirmed',
    'booking_rejected',
    'booking_cancelled',
    'booking_rescheduled',
    'booking_no_show',
    'booking_updated',
    'booking_undo_accept',
    'booking_undo_reject',
  ],
  BUSINESS: ['business_created', 'business_updated', 'business_deleted', 'business_suspended'],
  USER: [
    'user_created',
    'user_updated',
    'user_deleted',
    'role_changed',
    'admin_login',
    'admin_access_denied',
    'login_success',
    'login_failed',
    'password_reset',
  ],
  PAYMENT: ['payment_created', 'payment_succeeded', 'payment_failed', 'payment_refunded'],
  SYSTEM: [
    'notification_sent',
    'data_corrected',
    'data_correction',
    'system_config_changed',
    'config_updated',
    'admin_revenue_export',
    'cron_failed',
    'cron_recovered',
  ],
  SLOT: ['slot_reserved', 'slot_released', 'slot_booked'],
  MEDIA: ['media_uploaded', 'media_deleted'],
} as const;

export const AUDIT_SEVERITY = { INFO: 'info', WARNING: 'warning', CRITICAL: 'critical' } as const;
export type AuditSeverity = (typeof AUDIT_SEVERITY)[keyof typeof AUDIT_SEVERITY];

export const AUDIT_STATUS = { SUCCESS: 'success', FAILED: 'failed' } as const;
export type AuditStatus = (typeof AUDIT_STATUS)[keyof typeof AUDIT_STATUS];

/** Dedupe: skip insert if same action_type + entity_id + actor_id within this window (ms). */
export const AUDIT_DEDUPE_WINDOW_MS = 5000;

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

/** Pending booking (public book flow): set before redirect to login, read/cleared on /book/complete. */
export const PENDING_BOOKING_COOKIE = 'cusown_pending_booking';
export const PENDING_BOOKING_TTL_SECONDS = 600; // 10 min

/** Client: debounce Supabase auth refresh_token requests to avoid 429. */
export const AUTH_REFRESH_DEBOUNCE_MS = 60_000; // 1 min

/** Media: allowed image MIME types (no executables). */
export const MEDIA_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
] as const;
export type MediaAllowedMimeType = (typeof MEDIA_ALLOWED_MIME_TYPES)[number];

/** Media: max file size in bytes (10 MB). */
export const MEDIA_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
/** Media: max business images per business. */
export const MEDIA_MAX_BUSINESS_IMAGES = 20;
/** Media: entity types for DB. */
export const MEDIA_ENTITY_TYPES = ['business', 'profile'] as const;
export type MediaEntityType = (typeof MEDIA_ENTITY_TYPES)[number];

/** Media: idempotency resource types (must match DB). */
export const MEDIA_IDEMPOTENCY_RESOURCE_PROFILE = 'media_profile';
export const MEDIA_IDEMPOTENCY_RESOURCE_BUSINESS = 'media_business';

/** Media: processing status for variants pipeline. */
export const MEDIA_PROCESSING_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

/** Media: security log event types (anomaly detection). */
export const MEDIA_SECURITY_EVENTS = {
  UPLOAD_FAILED: 'upload_failed',
  MIME_MISMATCH: 'mime_mismatch',
  MAGIC_BYTE_REJECT: 'magic_byte_reject',
  SIZE_ABUSE: 'size_abuse',
  DUPLICATE_REJECT: 'duplicate_reject',
  REPEATED_FAILURES: 'repeated_failures',
  CIRCUIT_OPEN: 'circuit_open',
} as const;

/** Media: metrics names for observability. */
export const METRICS_MEDIA_UPLOAD_SUCCESS = 'media.upload.success';
export const METRICS_MEDIA_UPLOAD_FAILURE = 'media.upload.failure';
export const METRICS_MEDIA_UPLOAD_DURATION_MS = 'media.upload.duration_ms';
export const METRICS_MEDIA_SIGNED_URL_GENERATED = 'media.signed_url.generated';
export const METRICS_MEDIA_SIGNED_URL_DURATION_MS = 'media.signed_url.duration_ms';
export const METRICS_MEDIA_STORAGE_LATENCY_MS = 'media.storage.latency_ms';
export const METRICS_MEDIA_PURGE_COUNT = 'media.purge.count';
export const METRICS_MEDIA_ORPHAN_CLEANUP_COUNT = 'media.orphan_cleanup.count';

/** Media: circuit breaker — failures in window before opening. */
export const MEDIA_CIRCUIT_BREAKER_FAILURE_THRESHOLD = 10;
export const MEDIA_CIRCUIT_BREAKER_WINDOW_MS = 60_000;
export const MEDIA_CIRCUIT_BREAKER_COOLDOWN_MS = 120_000;

/** Media: signed URL short TTL (seconds) for strict mode. */
export const MEDIA_SIGNED_URL_TTL_SHORT_SECONDS = 300;
/** Media: default retention days for soft-deleted before hard purge. */
export const MEDIA_RETENTION_DAYS_SOFT_DELETED = 30;

/** Media: cache-control for signed URL responses (CDN/client). */
export const MEDIA_CACHE_CONTROL_HEADER = 'private, max-age=3600, stale-while-revalidate=86400';

/** Role names stored in DB (roles.name) and in user_roles. No "both" - use multiple roles. */
export const ROLES = ['customer', 'owner', 'admin'] as const;
export type RoleName = (typeof ROLES)[number];

/** Capabilities for layout/route access. Derive from roles; do not check role directly. */
export const CAPABILITIES = {
  ACCESS_ADMIN_DASHBOARD: 'access:admin_dashboard',
  ACCESS_OWNER_DASHBOARD: 'access:owner_dashboard',
  ACCESS_CUSTOMER_DASHBOARD: 'access:customer_dashboard',
  ACCESS_SETUP: 'access:setup',
} as const;
export type CapabilityName = (typeof CAPABILITIES)[keyof typeof CAPABILITIES];

/** Role → capabilities. Admin has all; owner/customer only their own unless both roles. */
export const ROLE_CAPABILITIES: Record<RoleName, CapabilityName[]> = {
  admin: [
    CAPABILITIES.ACCESS_ADMIN_DASHBOARD,
    CAPABILITIES.ACCESS_OWNER_DASHBOARD,
    CAPABILITIES.ACCESS_CUSTOMER_DASHBOARD,
    CAPABILITIES.ACCESS_SETUP,
  ],
  owner: [CAPABILITIES.ACCESS_OWNER_DASHBOARD, CAPABILITIES.ACCESS_SETUP],
  customer: [CAPABILITIES.ACCESS_CUSTOMER_DASHBOARD],
};
