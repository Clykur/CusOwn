/**
 * Token bucket rate limit: config-driven capacity and refill per second.
 * Identifier: IP (and optional session cookie hash). Does not call Supabase in middleware
 * to avoid Auth 429 (over_request_rate_limit). Per-route overrides for admin and export.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getClientIp } from '@/lib/security/client-ip.security';
import {
  TOKEN_BUCKET_CAPACITY,
  TOKEN_BUCKET_REFILL_PER_SEC,
  TOKEN_BUCKET_ADMIN_CAPACITY,
  TOKEN_BUCKET_ADMIN_REFILL_PER_SEC,
  TOKEN_BUCKET_EXPORT_CAPACITY,
  TOKEN_BUCKET_EXPORT_REFILL_PER_SEC,
  TOKEN_BUCKET_AUTH_CAPACITY,
  TOKEN_BUCKET_AUTH_REFILL_PER_SEC,
} from '@/config/constants';
import { ERROR_MESSAGES } from '@/config/constants';

interface BucketState {
  tokens: number;
  lastRefillMs: number;
}

const buckets = new Map<string, BucketState>();
const BUCKET_CLEANUP_MAX = 20_000;

function getRouteTier(pathname: string): 'admin' | 'export' | 'auth' | 'default' {
  if (pathname.startsWith('/api/admin/')) return 'admin';
  if (/\/api\/[^/]+\/export\/?/.test(pathname) || pathname.includes('/export')) return 'export';
  if (pathname === '/api/auth/login') return 'auth';
  return 'default';
}

function getCapacityRefill(tier: 'admin' | 'export' | 'auth' | 'default'): {
  capacity: number;
  refillPerSec: number;
} {
  switch (tier) {
    case 'admin':
      return {
        capacity: TOKEN_BUCKET_ADMIN_CAPACITY,
        refillPerSec: TOKEN_BUCKET_ADMIN_REFILL_PER_SEC,
      };
    case 'export':
      return {
        capacity: TOKEN_BUCKET_EXPORT_CAPACITY,
        refillPerSec: TOKEN_BUCKET_EXPORT_REFILL_PER_SEC,
      };
    case 'auth':
      return {
        capacity: TOKEN_BUCKET_AUTH_CAPACITY,
        refillPerSec: TOKEN_BUCKET_AUTH_REFILL_PER_SEC,
      };
    default:
      return { capacity: TOKEN_BUCKET_CAPACITY, refillPerSec: TOKEN_BUCKET_REFILL_PER_SEC };
  }
}

function refill(
  state: BucketState,
  capacity: number,
  refillPerSec: number,
  nowMs: number
): BucketState {
  const elapsedSec = (nowMs - state.lastRefillMs) / 1000;
  const added = elapsedSec * refillPerSec;
  const tokens = Math.min(capacity, state.tokens + added);
  return { tokens, lastRefillMs: nowMs };
}

function recordRateLimitBlock(): void {
  // Intentionally no-op in middleware runtime (Edge-safe path).
}

/** Lightweight identifier for rate limit without calling Supabase (avoids Auth 429). */
function getRateLimitIdentifier(request: NextRequest): string {
  const ip = getClientIp(request);
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return `ip:${ip}`;
  let hash = 0;
  for (let i = 0; i < Math.min(cookieHeader.length, 200); i++) {
    hash = (hash * 31 + cookieHeader.charCodeAt(i)) >>> 0;
  }
  return `ip:${ip}:${hash}`;
}

export async function tokenBucketRateLimit(request: NextRequest): Promise<NextResponse | null> {
  const pathname = request.nextUrl.pathname;
  const tier = getRouteTier(pathname);
  const { capacity, refillPerSec } = getCapacityRefill(tier);
  const identifier = getRateLimitIdentifier(request);

  const key = `tb:${tier}:${identifier}`;
  const nowMs = Date.now();

  if (buckets.size > BUCKET_CLEANUP_MAX) {
    const cutoff = nowMs - 60_000;
    for (const [k, v] of buckets.entries()) {
      if (v.lastRefillMs < cutoff) buckets.delete(k);
    }
  }

  let state = buckets.get(key);
  if (!state) {
    state = { tokens: capacity - 1, lastRefillMs: nowMs };
    buckets.set(key, state);
    return null;
  }

  state = refill(state, capacity, refillPerSec, nowMs);
  if (state.tokens < 1) {
    recordRateLimitBlock();
    return NextResponse.json({ error: ERROR_MESSAGES.RATE_LIMIT_EXCEEDED }, { status: 429 });
  }
  state.tokens -= 1;
  state.lastRefillMs = nowMs;
  buckets.set(key, state);
  return null;
}
