'use client';

import {
  ADMIN_CACHE_TTL_MS,
  ADMIN_CACHE_STALE_GRACE_MS,
  ADMIN_CACHE_MAX_ENTRIES,
} from '@/config/constants';

const TTL_MS = ADMIN_CACHE_TTL_MS;
const STALE_GRACE_MS = ADMIN_CACHE_STALE_GRACE_MS;
const MAX_ENTRIES = ADMIN_CACHE_MAX_ENTRIES;

export const ADMIN_CACHE_KEYS = {
  OVERVIEW: 'admin_overview',
  USERS: 'admin_users',
  BUSINESSES: 'admin_businesses',
  BOOKINGS: 'admin_bookings',
  AUDIT: 'admin_audit',
} as const;

export function getAdminAnalyticsCacheKey(startDate: string, endDate: string): string {
  return `admin_analytics_${startDate}_${endDate}`;
}

export function getSuccessMetricsCacheKey(startDate: string, endDate: string): string {
  return `admin_success_metrics_${startDate}_${endDate}`;
}

type CacheEntry = { data: unknown; timestamp: number };
const cache = new Map<string, CacheEntry>();
const accessOrder: string[] = [];

function touch(key: string) {
  const i = accessOrder.indexOf(key);
  if (i >= 0) accessOrder.splice(i, 1);
  accessOrder.push(key);
}

function evictOne() {
  const key = accessOrder.shift();
  if (key) cache.delete(key);
}

export function getAdminCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > TTL_MS) {
    cache.delete(key);
    const i = accessOrder.indexOf(key);
    if (i >= 0) accessOrder.splice(i, 1);
    return null;
  }
  touch(key);
  return entry.data as T;
}

/** Returns cached data even if TTL expired (stale). Use for instant render + background revalidate. */
export function getAdminCachedStale<T>(key: string): { data: T; stale: boolean } | null {
  const entry = cache.get(key);
  if (!entry) return null;
  touch(key);
  const stale = Date.now() - entry.timestamp > TTL_MS;
  if (Date.now() - entry.timestamp > STALE_GRACE_MS) {
    cache.delete(key);
    const i = accessOrder.indexOf(key);
    if (i >= 0) accessOrder.splice(i, 1);
    return null;
  }
  return { data: entry.data as T, stale };
}

export function setAdminCache(key: string, data: unknown): void {
  if (cache.size >= MAX_ENTRIES && !cache.has(key)) evictOne();
  touch(key);
  cache.set(key, { data, timestamp: Date.now() });
}

export function invalidateAdminCache(key: string): void {
  cache.delete(key);
  const i = accessOrder.indexOf(key);
  if (i >= 0) accessOrder.splice(i, 1);
}

export function invalidateAdminCacheByPrefix(prefix: string): void {
  for (const key of Array.from(cache.keys())) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
      const i = accessOrder.indexOf(key);
      if (i >= 0) accessOrder.splice(i, 1);
    }
  }
}

/** Clear all admin client cache (e.g. on 401 global handler). */
export function clearAllAdminCache(): void {
  cache.clear();
  accessOrder.length = 0;
}
