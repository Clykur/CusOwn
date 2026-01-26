import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

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

export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (request: NextRequest) => string;
}

export const rateLimit = (options: RateLimitOptions) => {
  return async (request: NextRequest): Promise<NextResponse | null> => {
    if (rateLimitStore.size > 10000) {
      cleanupRateLimitStore();
    }

    const key = options.keyGenerator
      ? options.keyGenerator(request)
      : `rate_limit:${request.ip || 'unknown'}`;

    const windowKey = `${key}:${Math.floor(Date.now() / options.windowMs)}`;
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

export const apiRateLimit = rateLimit({
  windowMs: 60000,
  maxRequests: 100,
  keyGenerator: (req) => `api:${req.ip || 'unknown'}`,
});

export const bookingRateLimit = rateLimit({
  windowMs: 60000,
  maxRequests: 10,
  keyGenerator: (req) => `booking:${req.ip || 'unknown'}`,
});
