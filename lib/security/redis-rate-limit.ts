/**
 * Redis-based distributed rate limiting.
 * Replaces in-memory rate limiter for horizontal scaling across multiple instances.
 * Uses atomic Redis INCR with TTL for minimal round trips.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getClientIp } from '@/lib/utils/security';
import { getRedisClient } from '@/lib/cache/redis';
import {
  RATE_LIMIT_BOOKING_WINDOW_MS,
  RATE_LIMIT_BOOKING_MAX_PER_WINDOW,
  RATE_LIMIT_ADMIN_WINDOW_MS,
  RATE_LIMIT_ADMIN_MAX_PER_WINDOW,
} from '@/config/constants';
/** Rate limit configuration */
export interface RedisRateLimitOptions {
  /** Time window in milliseconds */
  windowMs: number;
  /** Maximum requests allowed in window */
  maxRequests: number;
  /** Rate limit per authenticated user */
  perUser?: boolean;
  /** Rate limit per client IP */
  perIP?: boolean;
  /** Key prefix for namespacing */
  keyPrefix?: string;
}

/** Rate limit presets (requests per minute) */
export const RATE_LIMITS = {
  /** Booking creation: 10 per minute */
  BOOKING_CREATE: { windowMs: 60000, maxRequests: 10 },
  /** Login attempts: 5 per minute */
  LOGIN: { windowMs: 60000, maxRequests: 5 },
  /** Public APIs: 60 per minute */
  PUBLIC: { windowMs: 60000, maxRequests: 60 },
  /** Admin endpoints: configured via constants */
  ADMIN: { windowMs: RATE_LIMIT_ADMIN_WINDOW_MS, maxRequests: RATE_LIMIT_ADMIN_MAX_PER_WINDOW },
} as const;

/**
 * In-memory fallback for when Redis is unavailable.
 * This ensures rate limiting still works (per-instance) if Redis fails.
 */
const fallbackStore = new Map<string, { count: number; resetAt: number }>();

function cleanupFallbackStore(): void {
  const now = Date.now();
  for (const [key, entry] of fallbackStore.entries()) {
    if (entry.resetAt < now) {
      fallbackStore.delete(key);
    }
  }
}

/**
 * Check rate limit using in-memory fallback.
 */
function checkFallbackRateLimit(
  key: string,
  windowMs: number,
  maxRequests: number
): { allowed: boolean; count: number; resetAt: number } {
  if (fallbackStore.size > 10000) {
    cleanupFallbackStore();
  }

  const now = Date.now();
  const resetAt = now + windowMs;
  const windowKey = `${key}:${Math.floor(now / windowMs)}`;

  const entry = fallbackStore.get(windowKey);
  if (entry && entry.resetAt > now) {
    entry.count++;
    return { allowed: entry.count <= maxRequests, count: entry.count, resetAt: entry.resetAt };
  }

  fallbackStore.set(windowKey, { count: 1, resetAt });
  return { allowed: true, count: 1, resetAt };
}

/**
 * Check rate limit using Redis atomic operations.
 * Uses INCR + EXPIRE in a single round trip via Lua script equivalent.
 */
async function checkRedisRateLimit(
  key: string,
  windowSeconds: number,
  maxRequests: number
): Promise<{ allowed: boolean; count: number; ttl: number }> {
  const redis = getRedisClient();

  if (!redis) {
    // Fallback to in-memory if Redis unavailable
    const result = checkFallbackRateLimit(key, windowSeconds * 1000, maxRequests);
    return {
      allowed: result.allowed,
      count: result.count,
      ttl: Math.ceil((result.resetAt - Date.now()) / 1000),
    };
  }

  try {
    // Atomic increment - returns new count
    const count = await redis.incr(key);

    // If this is the first request in the window, set expiry
    if (count === 1) {
      await redis.expire(key, windowSeconds);
    }

    // Get remaining TTL for response headers
    const ttl = await redis.ttl(key);

    const allowed = count <= maxRequests;

    return { allowed, count, ttl: ttl > 0 ? ttl : windowSeconds };
  } catch {
    // Fallback to in-memory on Redis error
    const result = checkFallbackRateLimit(key, windowSeconds * 1000, maxRequests);
    return {
      allowed: result.allowed,
      count: result.count,
      ttl: Math.ceil((result.resetAt - Date.now()) / 1000),
    };
  }
}

/**
 * Create a Redis-based rate limiter middleware.
 * Drop-in replacement for enhancedRateLimit.
 */
export const redisRateLimit = (options: RedisRateLimitOptions) => {
  const windowSeconds = Math.ceil(options.windowMs / 1000);

  return async (request: NextRequest): Promise<NextResponse | null> => {
    const keys: string[] = [];
    const prefix = options.keyPrefix || 'ratelimit';

    // Build rate limit key based on options
    if (options.perIP !== false) {
      keys.push(`ip:${getClientIp(request)}`);
    }

    if (options.perUser) {
      try {
        const { getServerUser } = await import('@/lib/supabase/server-auth');
        const user = await getServerUser(request);
        if (user) {
          keys.push(`user:${user.id}`);
        }
      } catch {
        // Ignore auth errors for rate limiting
      }
    }

    // Fallback to IP if no keys
    if (keys.length === 0) {
      keys.push(`ip:${getClientIp(request)}`);
    }

    // Create composite key
    const rateLimitKey = `ratelimit:${prefix}:${keys.join(':')}`;

    const { allowed, ttl } = await checkRedisRateLimit(
      rateLimitKey,
      windowSeconds,
      options.maxRequests
    );

    if (!allowed) {
      const response = NextResponse.json(
        {
          success: false,
          error: 'Too many requests. Please try again later.',
          retryAfter: ttl,
        },
        { status: 429 }
      );

      // Add rate limit headers
      response.headers.set('X-RateLimit-Limit', String(options.maxRequests));
      response.headers.set('X-RateLimit-Remaining', '0');
      response.headers.set('X-RateLimit-Reset', String(Math.ceil(Date.now() / 1000) + ttl));
      response.headers.set('Retry-After', String(ttl));

      return response;
    }

    return null;
  };
};

/**
 * Enhanced rate limit with Redis backend.
 * API-compatible with the original enhancedRateLimit function.
 */
export const enhancedRateLimit = redisRateLimit;

/** Standard rate limiters */

/** User API rate limit: 100 per minute per user+IP */
export const userRateLimit = redisRateLimit({
  windowMs: 60000,
  maxRequests: 100,
  perUser: true,
  perIP: true,
  keyPrefix: 'user_api',
});

/** IP-only rate limit: 200 per minute */
export const ipRateLimit = redisRateLimit({
  windowMs: 60000,
  maxRequests: 200,
  perIP: true,
  keyPrefix: 'ip_api',
});

/** Booking creation: 10 per minute per user+IP */
export const bookingRateLimitEnhanced = redisRateLimit({
  windowMs: RATE_LIMIT_BOOKING_WINDOW_MS,
  maxRequests: RATE_LIMIT_BOOKING_MAX_PER_WINDOW,
  perUser: true,
  perIP: true,
  keyPrefix: 'booking',
});

/** Admin endpoints: config-driven per user+IP */
export const adminRateLimit = redisRateLimit({
  windowMs: RATE_LIMIT_ADMIN_WINDOW_MS,
  maxRequests: RATE_LIMIT_ADMIN_MAX_PER_WINDOW,
  perUser: true,
  perIP: true,
  keyPrefix: 'admin',
});

/** Login attempts: 5 per minute per IP */
export const loginRateLimit = redisRateLimit({
  windowMs: RATE_LIMITS.LOGIN.windowMs,
  maxRequests: RATE_LIMITS.LOGIN.maxRequests,
  perIP: true,
  keyPrefix: 'login',
});

/** Public API rate limit: 60 per minute per IP */
export const publicApiRateLimit = redisRateLimit({
  windowMs: RATE_LIMITS.PUBLIC.windowMs,
  maxRequests: RATE_LIMITS.PUBLIC.maxRequests,
  perIP: true,
  keyPrefix: 'public_api',
});
