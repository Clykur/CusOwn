import { BOOKING_LINK_PREFIX } from '@/config/constants';
import { NextRequest } from 'next/server';

const isLocalhost = (url: string): boolean => {
  return url.includes('localhost') || url.includes('127.0.0.1') || url.includes('0.0.0.0');
};

/** Ensure the localhost-in-production warning is only emitted once per process, and never during `next build`. */
let _localhostWarned = false;
const warnLocalhostOnce = (): void => {
  if (_localhostWarned) return;
  // Suppress during build — NODE_ENV is 'production' but localhost is expected.
  if (process.env.NEXT_PHASE === 'phase-production-build') return;
  _localhostWarned = true;
  // eslint-disable-next-line no-console
  console.warn(
    '[WARNING] Running in production with a localhost base URL. Set NEXT_PUBLIC_APP_URL to your production domain.'
  );
};

const isProduction = (): boolean => {
  if (process.env.NODE_ENV === 'production') return true;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  return appUrl ? !isLocalhost(appUrl) : false;
};

/** Production fallback when no env URL is set. Never use localhost in production. */
const PRODUCTION_FALLBACK_BASE = 'https://cusown.clykur.com';

export const getBaseUrl = (request?: NextRequest): string => {
  const isNode =
    typeof process !== 'undefined' && process.versions != null && process.versions.node != null;
  const prod = isProduction();

  // In production, never use localhost. Prefer env so QR and links always use public URL
  // (request.nextUrl.origin can be localhost in some serverless/internal routing).
  if (prod) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (appUrl && !isLocalhost(appUrl)) return appUrl.replace(/\/$/, '') || appUrl;
    const vercelUrl = process.env.VERCEL_URL;
    if (vercelUrl) return `https://${vercelUrl.replace(/^https?:\/\//, '')}`;
    if (request) {
      const origin = request.nextUrl?.origin;
      if (origin && !isLocalhost(origin)) return origin;
      const host = request.headers.get('host');
      if (host && !isLocalhost(host)) {
        const protocol =
          request.headers.get('x-forwarded-proto') ||
          request.headers.get('x-forwarded-protocol') ||
          'https';
        return `${protocol}://${host}`;
      }
    }
    return PRODUCTION_FALLBACK_BASE;
  }

  if (request) {
    const origin = request.nextUrl?.origin;
    if (origin && !isLocalhost(origin)) return origin;
    const host = request.headers.get('host');
    if (host && !isLocalhost(host)) {
      const protocol =
        request.headers.get('x-forwarded-proto') ||
        request.headers.get('x-forwarded-protocol') ||
        'https';
      return `${protocol}://${host}`;
    }
  }

  // Server environment (Node.js or Edge Runtime)
  const isServer = typeof window === 'undefined';

  if (isServer) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (appUrl) {
      if (process.env.NODE_ENV === 'production' && isLocalhost(appUrl)) {
        warnLocalhostOnce();
      }
      return appUrl;
    }
    const vercelUrl = process.env.VERCEL_URL;
    if (vercelUrl) return `https://${vercelUrl}`;
    return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  }

  try {
    if (typeof globalThis !== 'undefined' && 'window' in globalThis) {
      const win = globalThis as any;
      if (win.window?.location?.origin) {
        return win.window.location.origin;
      }
    }
  } catch {
    // ignore
  }

  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
};

/** Canonical short URL for sharing (e.g. WhatsApp). Use /b/[bookingLink] only; no long query params. */
export const getBookingUrl = (bookingLink: string, request?: NextRequest): string => {
  const baseUrl = getBaseUrl(request);
  return `${baseUrl}${BOOKING_LINK_PREFIX}${bookingLink}`;
};

export const getBookingStatusUrl = (bookingId: string, request?: NextRequest): string => {
  const baseUrl = getBaseUrl(request);
  return `${baseUrl}/booking/${bookingId}`;
};

export const getApiUrl = (path: string, request?: NextRequest): string => {
  const baseUrl = getBaseUrl(request);
  return `${baseUrl}${path}`;
};

export const getClientBaseUrl = (): string => {
  // Server environment (Node.js or Edge Runtime)
  const isServer = typeof window === 'undefined';

  if (isServer) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (appUrl) {
      if (process.env.NODE_ENV === 'production' && isLocalhost(appUrl)) {
        warnLocalhostOnce();
      }
      return appUrl;
    }
    const vercelUrl = process.env.VERCEL_URL;
    if (vercelUrl) return `https://${vercelUrl}`;
    return 'http://localhost:3000';
  }

  // Browser environment
  try {
    if (typeof globalThis !== 'undefined' && 'window' in globalThis) {
      const win = globalThis as any;
      if (win.window?.location?.origin) {
        return win.window.location.origin;
      }
    }
  } catch {
    // Ignore errors in Node.js environment
  }

  // Final fallback
  return 'http://localhost:3000';
};
