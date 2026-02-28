import {
  API_CACHE_MAX_KEYS,
  CACHE_TTL_API_DEFAULT_MS,
  CACHE_TTL_API_LONG_MS,
} from '@/config/constants';

type CacheEntry = {
  data: unknown;
  expiresAt: number;
  staleAt: number;
  lastAccess: number;
};
const cache = new Map<string, CacheEntry>();
const accessOrder: string[] = [];

function evictOne(): void {
  const key = accessOrder.shift();
  if (key) cache.delete(key);
}

function touch(key: string): void {
  const i = accessOrder.indexOf(key);
  if (i >= 0) accessOrder.splice(i, 1);
  accessOrder.push(key);
}

/**
 * Build cache key: method, path, serialized query params, auth scope (role or token hash).
 * Use tokenHash (from lib/utils/token-hash.server) for per-user cache; do not use raw token or prefix.
 */
export function buildApiCacheKey(
  method: string,
  path: string,
  searchParams?: Record<string, string> | URLSearchParams,
  scope?: string
): string {
  const parts = [method.toUpperCase(), path];
  if (searchParams) {
    const params =
      searchParams instanceof URLSearchParams ? Object.fromEntries(searchParams) : searchParams;
    const sorted = Object.keys(params)
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join('&');
    if (sorted) parts.push(sorted);
  }
  if (scope) parts.push(scope);
  return parts.join('|');
}

export function getCachedApiResponse<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) {
    void recordCacheMiss();
    return null;
  }
  const now = Date.now();
  if (now > entry.expiresAt) {
    cache.delete(key);
    const i = accessOrder.indexOf(key);
    if (i >= 0) accessOrder.splice(i, 1);
    void recordCacheMiss();
    return null;
  }
  touch(key);
  entry.lastAccess = now;
  void recordCacheHit();
  return entry.data as T;
}

function recordCacheHit(): void {
  import('@/lib/monitoring/metrics').then(({ metricsService }) => {
    void metricsService.increment('api.cache.hit');
  });
}

function recordCacheMiss(): void {
  import('@/lib/monitoring/metrics').then(({ metricsService }) => {
    void metricsService.increment('api.cache.miss');
  });
}

/**
 * Returns cached data if present (even if expired, for stale-while-revalidate).
 * Use getCachedApiResponse for strict TTL; use this when you want to return stale and revalidate.
 */
export function getCachedApiResponseStale<T>(key: string): { data: T; stale: boolean } | null {
  const entry = cache.get(key);
  if (!entry) return null;
  touch(key);
  const now = Date.now();
  const stale = now > entry.expiresAt;
  return { data: entry.data as T, stale };
}

export function setCachedApiResponse(
  key: string,
  data: unknown,
  ttlMs: number = CACHE_TTL_API_DEFAULT_MS
): void {
  if (cache.size >= API_CACHE_MAX_KEYS && !cache.has(key)) evictOne();
  touch(key);
  const now = Date.now();
  cache.set(key, {
    data,
    expiresAt: now + ttlMs,
    staleAt: now + ttlMs + Math.floor(ttlMs / 2),
    lastAccess: now,
  });
}

export function invalidateApiCacheKey(key: string): void {
  cache.delete(key);
  const i = accessOrder.indexOf(key);
  if (i >= 0) accessOrder.splice(i, 1);
}

export function invalidateApiCacheByPrefix(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
      const i = accessOrder.indexOf(key);
      if (i >= 0) accessOrder.splice(i, 1);
    }
  }
}

export const API_CACHE_TTL = {
  DEFAULT: CACHE_TTL_API_DEFAULT_MS,
  LONG: CACHE_TTL_API_LONG_MS,
} as const;
