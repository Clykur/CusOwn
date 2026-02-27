/**
 * Signed HTTP-only location cookie. Payload: city, region, country_code, lat, lon, source, exp.
 * Verify with HMAC; never expose secret to frontend.
 */

import { createHmac, timingSafeEqual } from 'crypto';
import { env } from '@/config/env';
import { LOCATION_COOKIE_NAME, LOCATION_COOKIE_MAX_AGE_SECONDS } from '@/config/constants';

export type LocationSource = 'gps' | 'ip';

export interface LocationPayload {
  city?: string;
  region?: string;
  country_code?: string;
  latitude?: number;
  longitude?: number;
  source: LocationSource;
  exp: number;
}

function getSecret(): string {
  return env.security.salonTokenSecret || 'fallback-location-cookie-secret';
}

function base64UrlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): Buffer | null {
  try {
    const padded =
      str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (str.length % 4)) % 4);
    return Buffer.from(padded, 'base64');
  } catch {
    return null;
  }
}

export function signLocationCookie(payload: Omit<LocationPayload, 'exp'>): string {
  const exp = Math.floor(Date.now() / 1000) + LOCATION_COOKIE_MAX_AGE_SECONDS;
  const full: LocationPayload = { ...payload, exp };
  const raw = JSON.stringify(full);
  const sig = createHmac('sha256', getSecret()).update(raw).digest();
  return base64UrlEncode(Buffer.from(raw, 'utf8')) + '.' + base64UrlEncode(sig);
}

export function verifyLocationCookie(value: string): LocationPayload | null {
  const dot = value.indexOf('.');
  if (dot === -1) return null;
  const payloadB64 = value.slice(0, dot);
  const sigB64 = value.slice(dot + 1);
  const payloadBuf = base64UrlDecode(payloadB64);
  const sigBuf = base64UrlDecode(sigB64);
  if (!payloadBuf || !sigBuf) return null;
  const expectedSig = createHmac('sha256', getSecret()).update(payloadBuf).digest();
  if (expectedSig.length !== sigBuf.length || !timingSafeEqual(expectedSig, sigBuf)) return null;
  try {
    const payload = JSON.parse(payloadBuf.toString('utf8')) as LocationPayload;
    if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function getLocationCookieName(): string {
  return LOCATION_COOKIE_NAME;
}

export function getLocationCookieMaxAge(): number {
  return LOCATION_COOKIE_MAX_AGE_SECONDS;
}
