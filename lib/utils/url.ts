import { BOOKING_LINK_PREFIX } from '@/config/constants';
import { NextRequest } from 'next/server';

const isLocalhost = (url: string): boolean => {
  return url.includes('localhost') || url.includes('127.0.0.1') || url.includes('0.0.0.0');
};

const isProduction = (): boolean => {
  if (process.env.NODE_ENV === 'production') return true;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  return appUrl ? !isLocalhost(appUrl) : false;
};

export const getBaseUrl = (request?: NextRequest): string => {
  if (request) {
    const origin = request.nextUrl.origin;
    if (origin && origin !== 'http://localhost:3000' && origin !== 'http://127.0.0.1:3000') {
      return origin;
    }
    const host = request.headers.get('host');
    if (host) {
      const protocol =
        request.headers.get('x-forwarded-proto') || (isLocalhost(host) ? 'http' : 'https');
      return `${protocol}://${host}`;
    }
  }

  // Check if we're in Node.js environment (not browser)
  const isNode =
    typeof process !== 'undefined' && process.versions != null && process.versions.node != null;

  if (isNode) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (appUrl) return appUrl;
    const vercelUrl = process.env.VERCEL_URL;
    if (vercelUrl) return `https://${vercelUrl}`;
    return isProduction()
      ? 'https://cusown.clykur.com'
      : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  }

  // Browser environment - check for window object safely
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

  return isProduction()
    ? 'https://cusown.clykur.com'
    : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
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
  // Check if we're in Node.js environment (not browser)
  const isNode =
    typeof process !== 'undefined' && process.versions != null && process.versions.node != null;

  if (isNode) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (appUrl) return appUrl;
    const vercelUrl = process.env.VERCEL_URL;
    if (vercelUrl) return `https://${vercelUrl}`;
    return isProduction()
      ? 'https://cusown.clykur.com'
      : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  }

  // Browser environment - check for window object safely
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

  // Fallback: check environment variables and production status
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) return appUrl;
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl}`;
  return isProduction()
    ? 'https://cusown.clykur.com'
    : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
};
