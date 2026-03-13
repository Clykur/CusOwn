/**
 * Cache helper utilities using Redis.
 * All operations fail gracefully - never break API responses.
 * Includes dev-mode logging for cache hits/misses.
 */

import { getRedisClient } from './redis';
import { env } from '@/config/env';

const isDev = env.nodeEnv === 'development';

/** TTL presets in seconds */
export const CACHE_TTL = {
  /** Public data (business profiles, categories) */
  PUBLIC: 300,
  /** Dashboard stats (owner/admin metrics) */
  DASHBOARD: 30,
  /** Slots (short TTL due to real-time nature) */
  SLOTS: 10,
  /** Business profiles */
  BUSINESS_PROFILE: 600,
  /** User profiles/auth cache */
  USER_PROFILE: 300,
  /** Search results */
  SEARCH: 60,
  /** Static metadata (categories, etc.) */
  STATIC: 600,
  /** Session/auth data */
  SESSION: 300,
} as const;

/** Cache key prefixes for namespacing */
export const CACHE_PREFIX = {
  BUSINESS: 'business:',
  SLOTS: 'slots:',
  BOOKING: 'booking:',
  USER: 'user:',
  DASHBOARD: 'dashboard:',
  SEARCH: 'search:',
  STATIC: 'static:',
  SESSION: 'session:',
} as const;

type CacheResult<T> = {
  hit: boolean;
  data: T | null;
};

/**
 * Get cached value by key.
 * Returns null if cache miss or Redis unavailable.
 */
export async function getCache<T>(key: string): Promise<CacheResult<T>> {
  const client = getRedisClient();

  if (!client) {
    return { hit: false, data: null };
  }

  try {
    const cached = await client.get(key);

    if (cached === null) {
      return { hit: false, data: null };
    }

    const parsed = JSON.parse(cached) as T;

    return { hit: true, data: parsed };
  } catch (err) {
    if (isDev) {
      console.error(`[Cache] GET error for ${key}:`, err);
    }
    return { hit: false, data: null };
  }
}

/**
 * Set cache value with TTL.
 * Fails silently if Redis unavailable.
 */
export async function setCache<T>(key: string, data: T, ttlSeconds: number): Promise<boolean> {
  const client = getRedisClient();

  if (!client) {
    return false;
  }

  try {
    const serialized = JSON.stringify(data);
    await client.setex(key, ttlSeconds, serialized);

    return true;
  } catch (err) {
    if (isDev) {
      console.error(`[Cache] SET error for ${key}:`, err);
    }
    return false;
  }
}

/**
 * Delete a specific cache key.
 */
export async function deleteCache(key: string): Promise<boolean> {
  const client = getRedisClient();

  if (!client) {
    return false;
  }

  try {
    await client.del(key);
    return true;
  } catch {
    return false;
  }
}

/**
 * Delete all keys matching a pattern.
 * Uses SCAN for production safety (non-blocking).
 */
export async function deletePattern(pattern: string): Promise<number> {
  const client = getRedisClient();

  if (!client) {
    return 0;
  }

  try {
    let cursor = '0';
    let deletedCount = 0;

    do {
      const [nextCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;

      if (keys.length > 0) {
        await client.del(...keys);
        deletedCount += keys.length;
      }
    } while (cursor !== '0');

    return deletedCount;
  } catch {
    return 0;
  }
}

/**
 * Get or set cache (cache-aside pattern).
 * If cache miss, calls fetcher and caches the result.
 */
export async function getOrSetCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number
): Promise<T> {
  const { hit, data } = await getCache<T>(key);

  if (hit && data !== null) {
    return data;
  }

  const freshData = await fetcher();
  await setCache(key, freshData, ttlSeconds);

  return freshData;
}

/**
 * Invalidate cache for a business (all related keys).
 */
export async function invalidateBusinessCache(businessId: string): Promise<void> {
  await Promise.all([
    deleteCache(`${CACHE_PREFIX.BUSINESS}${businessId}`),
    deletePattern(`${CACHE_PREFIX.SLOTS}${businessId}:*`),
    deletePattern(`${CACHE_PREFIX.BOOKING}${businessId}:*`),
    deletePattern(`${CACHE_PREFIX.DASHBOARD}owner:${businessId}:*`),
  ]);
}

/**
 * Invalidate cache for a user (all related keys).
 */
export async function invalidateUserCache(userId: string): Promise<void> {
  await Promise.all([
    deleteCache(`${CACHE_PREFIX.USER}${userId}`),
    deletePattern(`${CACHE_PREFIX.SESSION}${userId}:*`),
    deletePattern(`${CACHE_PREFIX.DASHBOARD}*:${userId}:*`),
  ]);
}

/**
 * Invalidate dashboard caches after booking mutation.
 * Call this after any booking create/update/cancel/accept/reject.
 */
export async function invalidateDashboardCaches(
  businessId: string,
  ownerId?: string
): Promise<void> {
  const patterns: string[] = [
    `${CACHE_PREFIX.DASHBOARD}admin-overview`,
    `${CACHE_PREFIX.DASHBOARD}analytics:*:${businessId}:*`,
    `${CACHE_PREFIX.DASHBOARD}analytics:*:all:*`,
  ];

  if (ownerId) {
    patterns.push(`${CACHE_PREFIX.DASHBOARD}owner-stats:${ownerId}:*`);
    patterns.push(`${CACHE_PREFIX.DASHBOARD}owner:${ownerId}:*`);
    patterns.push(`${CACHE_PREFIX.DASHBOARD}analytics:${ownerId}:*`);
  }

  await Promise.all(patterns.map((pattern) => deletePattern(pattern)));
}

/**
 * Invalidate all dashboard caches (admin overview, owner stats).
 * Use sparingly - prefer targeted invalidation.
 */
export async function invalidateAllDashboardCaches(): Promise<void> {
  await deletePattern(`${CACHE_PREFIX.DASHBOARD}*`);
}

/**
 * Build cache key with prefix and segments.
 */
export function buildCacheKey(prefix: string, ...segments: (string | number)[]): string {
  return `${prefix}${segments.join(':')}`;
}

/**
 * Check if caching is available.
 */
export function isCacheAvailable(): boolean {
  return getRedisClient() !== null;
}
