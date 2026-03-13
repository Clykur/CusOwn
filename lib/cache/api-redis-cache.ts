/**
 * Redis caching layer for public GET APIs.
 * Wraps API responses with Redis caching to reduce database load.
 * Falls back gracefully if Redis is unavailable.
 */

import { getCache, setCache } from './cache';
import { env } from '@/config/env';

const isDev = env.nodeEnv === 'development';

/** API-specific TTL values (in seconds) */
export const API_REDIS_TTL = {
  BUSINESS_PROFILE: 600,
  SLOTS: 10,
  SERVICES: 300,
  GEO: 3600,
  CATEGORIES: 600,
  SALONS_LIST: 300,
  LOCATIONS: 1800,
} as const;

/** Cache key prefix for API responses */
const API_CACHE_PREFIX = 'api:';

/**
 * Build a cache key from request URL including query params.
 * Normalizes the URL to ensure consistent keys.
 */
export function buildApiRedisKey(request: Request): string {
  const url = new URL(request.url);
  const path = url.pathname;
  const params = url.searchParams.toString();
  return params ? `${API_CACHE_PREFIX}${path}?${params}` : `${API_CACHE_PREFIX}${path}`;
}

/**
 * Build a cache key from path and optional params object.
 */
export function buildApiRedisKeyFromPath(
  path: string,
  params?: Record<string, string | number | boolean | undefined>
): string {
  if (!params || Object.keys(params).length === 0) {
    return `${API_CACHE_PREFIX}${path}`;
  }

  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      searchParams.set(key, String(value));
    }
  }
  searchParams.sort();
  return `${API_CACHE_PREFIX}${path}?${searchParams.toString()}`;
}

/**
 * Get cached API response from Redis.
 * Returns null if cache miss or Redis unavailable.
 */
export async function getApiRedisCache<T>(cacheKey: string): Promise<T | null> {
  try {
    const { hit, data } = await getCache<T>(cacheKey);
    return hit ? data : null;
  } catch (err) {
    if (isDev) {
      console.error(`[API Redis Cache] GET error for ${cacheKey}:`, err);
    }
    return null;
  }
}

/**
 * Set API response in Redis cache.
 * Fails silently if Redis unavailable.
 */
export async function setApiRedisCache<T>(
  cacheKey: string,
  data: T,
  ttlSeconds: number
): Promise<void> {
  try {
    await setCache(cacheKey, data, ttlSeconds);
  } catch (err) {
    if (isDev) {
      console.error(`[API Redis Cache] SET error for ${cacheKey}:`, err);
    }
  }
}

/**
 * Wrapper for cached API handlers.
 * Checks Redis first, falls back to handler, then caches result.
 */
export async function withApiRedisCache<T>(
  cacheKey: string,
  ttlSeconds: number,
  handler: () => Promise<T>
): Promise<{ data: T; fromCache: boolean }> {
  const cached = await getApiRedisCache<T>(cacheKey);
  if (cached !== null) {
    return { data: cached, fromCache: true };
  }

  const data = await handler();
  await setApiRedisCache(cacheKey, data, ttlSeconds);
  return { data, fromCache: false };
}
