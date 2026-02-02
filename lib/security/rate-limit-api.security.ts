import { NextRequest, NextResponse } from 'next/server';
import {
  RATE_LIMIT_BOOKING_WINDOW_MS,
  RATE_LIMIT_BOOKING_MAX_PER_WINDOW,
  RATE_LIMIT_ADMIN_WINDOW_MS,
  RATE_LIMIT_ADMIN_MAX_PER_WINDOW,
} from '@/config/constants';

interface RateLimitEntry {
  key: string;
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

const cleanupRateLimitStore = (): void => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
};

export interface EnhancedRateLimitOptions {
  windowMs: number;
  maxRequests: number;
  perUser?: boolean;
  perIP?: boolean;
  keyPrefix?: string;
}

export const enhancedRateLimit = (options: EnhancedRateLimitOptions) => {
  return async (request: NextRequest): Promise<NextResponse | null> => {
    if (rateLimitStore.size > 10000) {
      cleanupRateLimitStore();
    }

    const keys: string[] = [];
    const prefix = options.keyPrefix || 'rate_limit';

    if (options.perIP) {
      keys.push(`${prefix}:ip:${request.ip || 'unknown'}`);
    }

    if (options.perUser) {
      try {
        // Dynamically import to avoid bundling server-only code
        const { getServerUser } = await import('@/lib/supabase/server-auth');
        const user = await getServerUser(request);
        if (user) {
          keys.push(`${prefix}:user:${user.id}`);
        }
      } catch {
      }
    }

    if (keys.length === 0) {
      keys.push(`${prefix}:ip:${request.ip || 'unknown'}`);
    }

    const windowKey = `${keys.join(':')}:${Math.floor(Date.now() / options.windowMs)}`;
    const now = Date.now();
    const resetAt = now + options.windowMs;

    const entry = rateLimitStore.get(windowKey);
    if (entry && entry.resetAt > now) {
      entry.count++;
      if (entry.count > options.maxRequests) {
        return NextResponse.json(
          { error: 'Too many requests. Please try again later.' },
          { status: 429 }
        );
      }
    } else {
      rateLimitStore.set(windowKey, { key: windowKey, count: 1, resetAt });
    }

    return null;
  };
};

export const userRateLimit = enhancedRateLimit({
  windowMs: 60000,
  maxRequests: 100,
  perUser: true,
  perIP: true,
  keyPrefix: 'user_api',
});

export const ipRateLimit = enhancedRateLimit({
  windowMs: 60000,
  maxRequests: 200,
  perIP: true,
  keyPrefix: 'ip_api',
});

/** Phase 5: Booking creation — per IP + per user (config-driven). */
export const bookingRateLimitEnhanced = enhancedRateLimit({
  windowMs: RATE_LIMIT_BOOKING_WINDOW_MS,
  maxRequests: RATE_LIMIT_BOOKING_MAX_PER_WINDOW,
  perUser: true,
  perIP: true,
  keyPrefix: 'booking',
});

/** Phase 5: Admin endpoints — per user + per IP. */
export const adminRateLimit = enhancedRateLimit({
  windowMs: RATE_LIMIT_ADMIN_WINDOW_MS,
  maxRequests: RATE_LIMIT_ADMIN_MAX_PER_WINDOW,
  perUser: true,
  perIP: true,
  keyPrefix: 'admin',
});
