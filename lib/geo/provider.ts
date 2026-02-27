/**
 * BigDataCloud provider: fallback only. 3s timeout, 1 retry, in-memory cache for IP.
 * API key from env only; never logged or exposed. Never call in loops.
 */

import { createHmac } from 'crypto';
import { GEO_BIGDATACLOUD_BASE } from '@/config/constants';
import { validateCoordinates } from '@/lib/utils/geo';
import { env } from '@/config/env';
import { getIpCached, setIpCached, type CachedLocation } from './cache';
import {
  GEO_PROVIDER_TIMEOUT_MS,
  GEO_PROVIDER_MAX_RETRIES,
  GEO_CACHE_MAX_AGE_SECONDS,
} from '@/config/constants';

const REVERSE_GEOCODE_PATH = '/reverse-geocode-client';
const IP_GEOLOCATION_PATH = '/ip-geolocation';

export interface ReverseGeocodeResult {
  city?: string;
  region?: string;
  countryCode?: string;
  countryName?: string;
  latitude?: number;
  longitude?: number;
}

export interface IpGeocodeResult {
  city?: string;
  region?: string;
  countryCode?: string;
  countryName?: string;
  latitude?: number;
  longitude?: number;
}

function getApiKey(): string {
  return env.geo.bigDataCloudApiKey ?? '';
}

function buildUrl(path: string, params: Record<string, string>): string {
  const url = new URL(path, GEO_BIGDATACLOUD_BASE);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') url.searchParams.set(k, v);
  });
  const key = getApiKey();
  if (key.trim() !== '') url.searchParams.set('key', key.trim());
  return url.toString();
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
      next: { revalidate: GEO_CACHE_MAX_AGE_SECONDS },
    });
    clearTimeout(timeout);
    return res;
  } catch {
    clearTimeout(timeout);
    throw new Error('Geo request failed');
  }
}

/**
 * Reverse-geocode coordinates. BigDataCloud only; 3s timeout, 1 retry. No cache here (caller caches in DB/cookie).
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
  options?: { localityLanguage?: string }
): Promise<ReverseGeocodeResult | null> {
  if (!validateCoordinates(latitude, longitude)) return null;

  const url = buildUrl(REVERSE_GEOCODE_PATH, {
    latitude: String(latitude),
    longitude: String(longitude),
    ...(options?.localityLanguage && { localityLanguage: options.localityLanguage }),
  });

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= GEO_PROVIDER_MAX_RETRIES; attempt++) {
    try {
      const res = await fetchWithTimeout(url, GEO_PROVIDER_TIMEOUT_MS);
      if (!res.ok) return null;
      const data = (await res.json()) as {
        city?: string;
        locality?: string;
        principalSubdivision?: string;
        countryCode?: string;
        countryName?: string;
        latitude?: number;
        longitude?: number;
      };
      return {
        city: data.city ?? data.locality,
        region: data.principalSubdivision,
        countryCode: data.countryCode,
        countryName: data.countryName,
        latitude: data.latitude,
        longitude: data.longitude,
      };
    } catch (e) {
      lastError = e instanceof Error ? e : new Error('Unknown');
    }
  }
  return null;
}

/**
 * IP geolocation. Checks in-memory LRU cache first; then BigDataCloud with 3s timeout, 1 retry. Caches result 1h.
 */
export async function ipGeocode(ip: string): Promise<IpGeocodeResult | null> {
  const cached = getIpCached(ip);
  if (cached) {
    return {
      city: cached.city,
      region: cached.region,
      countryCode: cached.countryCode,
      countryName: cached.countryName,
      latitude: cached.latitude,
      longitude: cached.longitude,
    };
  }

  const url = buildUrl(IP_GEOLOCATION_PATH, { ip });
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= GEO_PROVIDER_MAX_RETRIES; attempt++) {
    try {
      const res = await fetchWithTimeout(url, GEO_PROVIDER_TIMEOUT_MS);
      if (!res.ok) return null;
      const data = (await res.json()) as {
        country?: { name?: string; code?: string };
        location?: {
          city?: string;
          principalSubdivision?: string;
          latitude?: number;
          longitude?: number;
        };
        locality?: string;
      };
      const result: IpGeocodeResult = {
        city: data.location?.city ?? data.locality,
        region: data.location?.principalSubdivision,
        countryCode: data.country?.code,
        countryName: data.country?.name,
        latitude: data.location?.latitude,
        longitude: data.location?.longitude,
      };
      setIpCached(ip, result);
      return result;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error('Unknown');
    }
  }
  return null;
}
