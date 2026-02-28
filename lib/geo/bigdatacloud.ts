/**
 * BigDataCloud geolocation APIs (free without key; optional BIGDATACLOUD_API_KEY for higher limits).
 * Used for reverse-geocode (lat/lon → city/region) and IP geolocation.
 * See: https://www.bigdatacloud.com
 */

import { GEO_BIGDATACLOUD_BASE } from '@/config/constants';
import { validateCoordinates } from '@/lib/utils/geo';
import { env } from '@/config/env';

export interface ReverseGeocodeResult {
  city?: string;
  locality?: string;
  principalSubdivision?: string;
  countryCode?: string;
  countryName?: string;
  localityInfo?: {
    administrative?: Array<{ name?: string; order?: number }>;
    informative?: Array<{ name?: string; order?: number }>;
  };
  plusCode?: string;
  latitude?: number;
  longitude?: number;
}

export interface IpGeolocationResult {
  ip?: string;
  country?: { name?: string; code?: string };
  location?: {
    city?: string;
    principalSubdivision?: string;
    latitude?: number;
    longitude?: number;
  };
  locality?: string;
  localityInfo?: ReverseGeocodeResult['localityInfo'];
}

const REVERSE_GEOCODE_PATH = '/reverse-geocode-client';
const IP_GEOLOCATION_PATH = '/ip-geolocation';

function buildUrl(path: string, params: Record<string, string>, apiKey?: string): string {
  const url = new URL(path, GEO_BIGDATACLOUD_BASE);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') url.searchParams.set(k, v);
  });
  if (apiKey && apiKey.trim() !== '') {
    url.searchParams.set('key', apiKey.trim());
  }
  return url.toString();
}

function getApiKey(): string {
  return env.geo.bigDataCloudApiKey ?? '';
}

/**
 * Reverse-geocode coordinates to location info (city, region, country).
 * Free, no API key. Uses BigDataCloud reverse-geocode-client endpoint.
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
  options?: { localityLanguage?: string }
): Promise<ReverseGeocodeResult | null> {
  if (!validateCoordinates(latitude, longitude)) {
    return null;
  }

  const url = buildUrl(
    REVERSE_GEOCODE_PATH,
    {
      latitude: String(latitude),
      longitude: String(longitude),
      ...(options?.localityLanguage && {
        localityLanguage: options.localityLanguage,
      }),
    },
    getApiKey()
  );

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
      next: { revalidate: 86400 },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = (await res.json()) as ReverseGeocodeResult;
    return data;
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

/**
 * Get geolocation for an IP address.
 * Free, no API key. Uses BigDataCloud ip-geolocation endpoint. Pass ip to look up (e.g. client IP when proxying from server).
 */
export async function ipGeolocation(ip: string): Promise<IpGeolocationResult | null> {
  const url = buildUrl(IP_GEOLOCATION_PATH, { ip }, getApiKey());

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
      next: { revalidate: 3600 },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = (await res.json()) as IpGeolocationResult;
    return data;
  } catch {
    clearTimeout(timeout);
    return null;
  }
}
