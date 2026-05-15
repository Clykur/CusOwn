/**
 * Client-side in-memory cache for business profile page data (salon, services, photos).
 * Reduces repeat requests and allows browser to serve images from its cache when URLs are reused.
 */

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const salonCache = new Map<string, CacheEntry<unknown>>();

function isStale<T>(entry: CacheEntry<T>): boolean {
  return Date.now() - entry.timestamp > CACHE_TTL_MS;
}

export function getCachedBusinessProfile(slug: string): unknown | null {
  const entry = salonCache.get(slug) as CacheEntry<unknown> | undefined;
  if (!entry || isStale(entry)) return null;
  return entry.data;
}

export function setCachedBusinessProfile(slug: string, data: unknown): void {
  salonCache.set(slug, { data, timestamp: Date.now() });
}
