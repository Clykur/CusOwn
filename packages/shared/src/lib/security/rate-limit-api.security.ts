/**
 * Rate limiting API security.
 * Uses Redis-based distributed rate limiting for horizontal scaling.
 * Falls back to in-memory rate limiting if Redis is unavailable.
 *
 * Re-exports from redis-rate-limit.ts for backward compatibility.
 */

export {
  enhancedRateLimit,
  redisRateLimit,
  userRateLimit,
  ipRateLimit,
  bookingRateLimitEnhanced,
  adminRateLimit,
  loginRateLimit,
  publicApiRateLimit,
  RATE_LIMITS,
} from './redis-rate-limit';

export type { RedisRateLimitOptions as EnhancedRateLimitOptions } from './redis-rate-limit';
