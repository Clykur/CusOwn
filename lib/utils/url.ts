import { BOOKING_LINK_PREFIX } from '@/config/constants';
import { env } from '@/config/env';
import { NextRequest } from 'next/server';

const getEnvValue = (key: string): string => {
  const value = process.env[key];
  if (!value) return '';
  const normalized = value.trim();
  if (!normalized || normalized === 'undefined' || normalized === 'null') return '';
  return normalized;
};

const getProductionFallbackBase = (): string => {
  const value = env.app.baseUrl.replace(/\/$/, '');
  if (!isLocalhost(value)) return value;
  return ['https:', '', 'cusown.clykur.com'].join('/');
};

const isLocalhost = (url: string): boolean => {
  return url.includes('localhost') || url.includes('127.0.0.1') || url.includes('0.0.0.0');
};

const isProduction = (): boolean => {
  if (getEnvValue('NODE_ENV') === 'production') return true;
  const appUrl = getEnvValue('NEXT_PUBLIC_APP_URL');
  return appUrl ? !isLocalhost(appUrl) : false;
};

/** Production fallback when no env URL is set. Never use localhost in production. */
const PRODUCTION_FALLBACK_BASE = getProductionFallbackBase();

export const getBaseUrl = (request?: NextRequest): string => {
  const isServer = !(typeof globalThis !== 'undefined' && 'window' in globalThis);
  const prod = isProduction();

  // In production, never use localhost. Prefer env so QR and links always use public URL
  // (request.nextUrl.origin can be localhost in some serverless/internal routing).
  if (prod) {
    const appUrl = getEnvValue('NEXT_PUBLIC_APP_URL');
    if (appUrl && !isLocalhost(appUrl)) return appUrl.replace(/\/$/, '') || appUrl;
    const vercelUrl = getEnvValue('VERCEL_URL');
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

  if (isServer) {
    const appUrl = getEnvValue('NEXT_PUBLIC_APP_URL');
    if (appUrl) return appUrl;
    const vercelUrl = getEnvValue('VERCEL_URL');
    if (vercelUrl) return `https://${vercelUrl}`;
    return appUrl || 'http://localhost:3000';
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

  return getEnvValue('NEXT_PUBLIC_APP_URL') || 'http://localhost:3000';
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
  // Server-side path for SSR/runtime where window is unavailable.
  const isServer = !(typeof globalThis !== 'undefined' && 'window' in globalThis);

  if (isServer) {
    const appUrl = getEnvValue('NEXT_PUBLIC_APP_URL');
    if (appUrl) return appUrl;
    const vercelUrl = getEnvValue('VERCEL_URL');
    if (vercelUrl) return `https://${vercelUrl}`;
    return isProduction() ? PRODUCTION_FALLBACK_BASE : appUrl || 'http://localhost:3000';
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
  const appUrl = getEnvValue('NEXT_PUBLIC_APP_URL');
  if (appUrl) return appUrl;
  const vercelUrl = getEnvValue('VERCEL_URL');
  if (vercelUrl) return `https://${vercelUrl}`;
  return isProduction() ? PRODUCTION_FALLBACK_BASE : appUrl || 'http://localhost:3000';
};
