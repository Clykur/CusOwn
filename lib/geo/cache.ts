/**
 * In-memory LRU cache for IP geolocation results. TTL 1 hour; avoids calling BigDataCloud on every request.
 * Not shared across serverless instances; each instance has its own cache. Safe for high traffic per instance.
 */

import { GEO_IP_CACHE_TTL_MS, GEO_IP_CACHE_MAX_ENTRIES } from '@/config/constants';

export interface CachedLocation {
  city?: string;
  region?: string;
  countryCode?: string;
  countryName?: string;
  latitude?: number;
  longitude?: number;
  cachedAt: number;
}

interface Entry {
  value: CachedLocation;
  expiresAt: number;
}

const store = new Map<string, Entry>();
const accessOrder: string[] = [];

function prune(): void {
  const now = Date.now();
  while (accessOrder.length > 0) {
    const key = accessOrder[0];
    const entry = store.get(key);
    if (!entry || entry.expiresAt <= now) {
      accessOrder.shift();
      if (entry) store.delete(key);
    } else {
      break;
    }
  }
  while (store.size > GEO_IP_CACHE_MAX_ENTRIES && accessOrder.length > 0) {
    const key = accessOrder.shift()!;
    store.delete(key);
  }
}

export function getIpCached(ip: string): CachedLocation | null {
  prune();
  const entry = store.get(ip);
  if (!entry || entry.expiresAt <= Date.now()) {
    if (entry) {
      store.delete(ip);
      const i = accessOrder.indexOf(ip);
      if (i !== -1) accessOrder.splice(i, 1);
    }
    return null;
  }
  const i = accessOrder.indexOf(ip);
  if (i !== -1) accessOrder.splice(i, 1);
  accessOrder.push(ip);
  return entry.value;
}

export function setIpCached(ip: string, value: Omit<CachedLocation, 'cachedAt'>): void {
  prune();
  const now = Date.now();
  const existing = accessOrder.indexOf(ip);
  if (existing !== -1) accessOrder.splice(existing, 1);
  accessOrder.push(ip);
  store.set(ip, {
    value: { ...value, cachedAt: now },
    expiresAt: now + GEO_IP_CACHE_TTL_MS,
  });
}
