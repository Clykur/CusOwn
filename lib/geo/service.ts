/**
 * Location service: cookie → DB → BigDataCloud (fallback once). Never call external API on every request.
 * Persist all resolved locations; treat as fresh if < 7 days.
 */

import { NextRequest } from 'next/server';
import { getClientIp } from '@/lib/utils/security';
import { supabaseAdmin } from '@/lib/supabase/server';
import {
  LOCATION_FRESH_DAYS,
  LOCATION_COOKIE_NAME,
  LOCATION_COOKIE_MAX_AGE_SECONDS,
} from '@/config/constants';
import { signLocationCookie, verifyLocationCookie, type LocationSource } from './location-cookie';
import { ipGeocode } from './provider';

export interface ResolvedLocation {
  city?: string;
  region?: string;
  country_code?: string;
  latitude?: number;
  longitude?: number;
  source: LocationSource;
  detected_at?: string;
}

const FRESH_MS = LOCATION_FRESH_DAYS * 24 * 60 * 60 * 1000;

function isFresh(detectedAt: Date | string): boolean {
  const t = typeof detectedAt === 'string' ? new Date(detectedAt).getTime() : detectedAt.getTime();
  return Date.now() - t < FRESH_MS;
}

function getCookiePayload(request: NextRequest): ResolvedLocation | null {
  const cookie = request.cookies.get(LOCATION_COOKIE_NAME)?.value;
  if (!cookie) return null;
  const payload = verifyLocationCookie(cookie);
  if (!payload) return null;
  if (!isFresh(new Date(payload.exp * 1000))) return null;
  return {
    city: payload.city,
    region: payload.region,
    country_code: payload.country_code,
    latitude: payload.latitude,
    longitude: payload.longitude,
    source: payload.source,
  };
}

async function getFromDb(userId: string): Promise<ResolvedLocation | null> {
  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin
    .from('user_locations')
    .select('city, region, country_code, latitude, longitude, source, detected_at')
    .eq('user_id', userId)
    .order('detected_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const detectedAt = data.detected_at as string;
  if (!isFresh(detectedAt)) return null;
  return {
    city: data.city ?? undefined,
    region: data.region ?? undefined,
    country_code: data.country_code ?? undefined,
    latitude: data.latitude ?? undefined,
    longitude: data.longitude ?? undefined,
    source: (data.source as LocationSource) ?? 'ip',
    detected_at: detectedAt,
  };
}

/**
 * Get current user location: cookie (if valid & fresh) → DB (if user and fresh) → BigDataCloud IP once, then persist.
 * BigDataCloud is called only when no cookie and no fresh DB row; result is cached in DB + cookie.
 */
export async function getLocation(
  request: NextRequest,
  userId?: string | null
): Promise<{
  location: ResolvedLocation | null;
  setCookieHeader?: string;
}> {
  const fromCookie = getCookiePayload(request);
  if (fromCookie) return { location: fromCookie };

  if (userId) {
    const fromDb = await getFromDb(userId);
    if (fromDb) {
      return { location: fromDb };
    }
  }

  const ip = getClientIp(request);
  const fromProvider = await ipGeocode(ip);
  if (!fromProvider) return { location: null };

  const resolved: ResolvedLocation = {
    city: fromProvider.city,
    region: fromProvider.region,
    country_code: fromProvider.countryCode,
    latitude: fromProvider.latitude,
    longitude: fromProvider.longitude,
    source: 'ip',
  };

  if (userId && supabaseAdmin) {
    await supabaseAdmin.from('user_locations').insert({
      user_id: userId,
      city: resolved.city ?? null,
      region: resolved.region ?? null,
      country_code: resolved.country_code ?? null,
      latitude: resolved.latitude ?? null,
      longitude: resolved.longitude ?? null,
      source: 'ip',
      detected_at: new Date().toISOString(),
    });
  }

  const cookieValue = signLocationCookie({
    city: resolved.city,
    region: resolved.region,
    country_code: resolved.country_code,
    latitude: resolved.latitude,
    longitude: resolved.longitude,
    source: 'ip',
  });
  const setCookieHeader = `${LOCATION_COOKIE_NAME}=${cookieValue}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${LOCATION_COOKIE_MAX_AGE_SECONDS}`;

  return { location: resolved, setCookieHeader };
}

/**
 * Persist location from client (e.g. after navigator.geolocation or reverse-geocode). Writes to DB and returns Set-Cookie header.
 */
export async function setLocation(
  request: NextRequest,
  payload: {
    latitude: number;
    longitude: number;
    city?: string;
    region?: string;
    country_code?: string;
    source: LocationSource;
  },
  userId?: string | null
): Promise<{ setCookieHeader: string }> {
  if (userId && supabaseAdmin) {
    await supabaseAdmin.from('user_locations').insert({
      user_id: userId,
      city: payload.city ?? null,
      region: payload.region ?? null,
      country_code: payload.country_code ?? null,
      latitude: payload.latitude,
      longitude: payload.longitude,
      source: payload.source,
      detected_at: new Date().toISOString(),
    });
  }

  const cookieValue = signLocationCookie({
    city: payload.city,
    region: payload.region,
    country_code: payload.country_code,
    latitude: payload.latitude,
    longitude: payload.longitude,
    source: payload.source,
  });
  const setCookieHeader = `${LOCATION_COOKIE_NAME}=${cookieValue}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${LOCATION_COOKIE_MAX_AGE_SECONDS}`;
  return { setCookieHeader };
}
