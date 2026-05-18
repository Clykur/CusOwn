// Server-only exports (Database, Services, Admin Auth)
export * from './lib/queue';
export * from './services/access.service';
export * from './services/permission.service';
export { hasPermission, PERMISSIONS } from './services/permission.service';
export * from './services/salon.service';
export * from './services/booking.service';
export * from './services/business-hours.service';
export * from './services/downtime.service';
export * from './services/slot.service';
export * from './services/user.service';
export * from './services/whatsapp.service';
export * from './services/audit.service';
export * from './services/reminder.service';
export * from './services/auth-events.service';
export * from './services/admin.service';
export * from './services/analytics.service';
export * from './services/dashboard.service';
export * from './services/rating-prompt.service';
export * from './services/review.service';
export * from './services/storage-overview.service';
export * from './services/admin-analytics.service';
export * from './services/admin-notification.service';
export * from './services/cron-run.service';
export * from './services/media.service';
export * from './services/payment.service';
export * from './services/service.service';
export * from './services/no-show.service';
export * from './services/fraud.service';
export { hashIp } from './lib/fraud/ip-hash';
export { NominatimService } from './lib/geocoding/nominatim-service';
export * from './lib/security/cron-auth';
export * from './lib/content/profanity-filter';
export * from './lib/security/csrf';
export { successResponse, errorResponse } from './lib/utils/response';
export * from './lib/security/redis-rate-limit';
export { redisRateLimit as enhancedRateLimit } from './lib/security/redis-rate-limit';

// Server-side Libs
export * from './lib/slot-booking-duration';
export { computeTotalBookingDurationMinutes } from './lib/slot-booking-duration';
export * from './lib/slot-capacity-timeline';
export * from './lib/supabase/server';
export { requireSupabaseAdmin } from './lib/supabase/server';
export * from './lib/supabase/server-auth';
export * from './lib/utils/secure-link-validation.server';
export * from './lib/utils/owner-business-guard.server';
export * from './lib/utils/booking-business-access.server';

// New Server Utilities
export * from './lib/security/input-sanitizer.server';
export * from './lib/security/nonce-store';
export * from './lib/security/abuse-detection';
export * from './lib/utils/security.server';
export * from './lib/utils/navigation.server';
export * from './lib/utils/url.server';
export * from './lib/cache/cache';
export {
  buildApiCacheKey,
  getCachedApiResponse,
  setCachedApiResponse,
  invalidateApiCacheKey,
  invalidateApiCacheByPrefix,
  invalidateBusinessCacheBySlug,
  invalidateBookingCache,
  API_CACHE_TTL,
} from './lib/cache/api-response-cache';
export * from './lib/cache/api-redis-cache';
export * from './lib/cache/auth-cache';
export * from './lib/security/input-filter';
export * from './lib/utils/api-auth-pipeline';
export * from './lib/utils/date-range-admin';
export { checkIsAdmin, checkIsAdminServer, requireAdmin } from './lib/utils/admin';
export * from './lib/utils/admin-deletion.server';
export * from './lib/utils/edge-helpers';
export { getClientIp } from './lib/utils/edge-helpers';
export * from './lib/cache/next-cache';
export * from './lib/utils/role-verification';
export * from './lib/utils/validation';
export { getUserFriendlyError } from './lib/utils/error-handler';
export {
  normalizeTime,
  timeToMinutes,
  minutesToTime,
  addMinutes,
  isTimeAfter,
  isTimeBefore,
} from './lib/utils/time';
export { generateQRCodeForBookingLink } from './lib/utils/qrcode';
export * from './lib/utils/business-schedule-validation';
export * from './lib/db/business-query-filters';
export * from './services/business-category.service';
export * from './lib/monitoring/auth-audit';
export * from './lib/observability/structured-log';
export * from './lib/utils/booking-action-token-query.server';
export * from './lib/monitoring/performance';
export * from './lib/cache/request-dedup';
export * from './lib/utils/token-hash.server';
export { hashToken } from './lib/utils/token-hash.server';
export { getUserState, shouldRedirectUser } from './lib/utils/user-state';

// Server-side Auth & Cookies
export {
  getServerUser,
  createServerClient,
  getServerUserProfile,
} from './lib/supabase/server-auth';
export * from './lib/auth/pending-booking-cookie';

// Events & Monitoring
export * from './lib/events/booking-events';
export * from './lib/monitoring/safe-metrics';
export * from './lib/monitoring/lifecycle-structured-log';
export * from './lib/monitoring/health';
export * from './lib/utils/pagination';
export { isValidUUID } from './lib/utils/security';
export { sanitizeForLog } from './lib/utils/sanitize-for-log';
export {
  parsePaymentVerifyRequest,
  extractValidPaymentSignature,
  requirePaymentVerifyRequest,
  PaymentVerifyClientError,
} from './lib/security/payment-verify-request.server';
export { runPaymentVerifyApi } from './lib/security/payment-verify-handler.server';

// Re-exports for build stability
export * from './services/recommendation.service';
export * from './services/notification.service';
export * from './services/reschedule.service';
export * from './lib/monitoring/alerting';
export * from './lib/monitoring/success-metrics';
export { geolocationService } from './lib/services/geolocation.service';
export * from './lib/geo/service';
export * from './lib/geo/provider';
export * from './lib/geo/geo-service-wrapper';
export * from './lib/geo/geo-cooldown-store';
export * from './lib/utils/geo';
export * from './lib/auth/getOAuthRedirect';
export * from './lib/security/input-sanitizer';
export * from './lib/security/webhook-verification';
export * from './lib/utils/upi-payment';
export * from './lib/db/discovery-fallback';
export * from './lib/routing';
export * from './lib/media/storage-provider-supabase';
export * from './lib/supabase/auth';
export * from './lib/whatsapp';
export * from './types';

// Re-export common client-safe utils needed by server
export * from './lib/utils/navigation';
export * from './lib/utils/string';
export * from './lib/utils/url';
export { getBaseUrl, getApiUrl, getBookingUrl, getBookingStatusUrl } from './lib/utils/url.server';
export * from './lib/time/ist';
