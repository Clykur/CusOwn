/**
 * Production-grade security headers. Apply to all responses via middleware.
 */

import { NextResponse } from 'next/server';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const APP_ORIGIN = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

/** Allowed connect-src for CSP: self, Supabase, Google OAuth, Vercel Analytics. */
function getCspConnectSrc(): string {
  const parts = ["'self'"];
  if (SUPABASE_URL) parts.push(SUPABASE_URL.replace(/\/$/, ''));
  parts.push(
    'https://*.supabase.co',
    'https://accounts.google.com',
    'https://va.vercel-scripts.com',
    'https://vercel.live'
  );
  return parts.join(' ');
}

/** frame-src: OAuth and Supabase. */
function getCspFrameSrc(): string {
  return ["'self'", 'https://accounts.google.com', 'https://*.supabase.co'].join(' ');
}

/** script-src: self, inline/eval for Next, Vercel Analytics. */
function getCspScriptSrc(): string {
  return "'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com https://vercel.live";
}

/** script-src-elem: explicit script element sources to avoid fallback issues. */
function getCspScriptSrcElem(): string {
  return "'self' 'unsafe-inline' https://va.vercel-scripts.com https://vercel.live";
}

/** style-src: self and inline for CSS-in-JS. */
function getCspStyleSrc(): string {
  return "'self' 'unsafe-inline'";
}

/** img-src: self, data, blob, Supabase storage. */
function getCspImgSrc(): string {
  const parts = ["'self'", 'data:', 'blob:'];
  if (SUPABASE_URL) {
    parts.push(SUPABASE_URL.replace(/\/$/, '')); // NO /* here
  }
  return parts.join(' ');
}

/** default-src fallback. */
function getCspDefaultSrc(): string {
  return "'self'";
}

export function getSecurityHeaders(): Record<string, string> {
  const csp = [
    `default-src ${getCspDefaultSrc()}`,
    `connect-src ${getCspConnectSrc()}`,
    `frame-src ${getCspFrameSrc()}`,
    `script-src ${getCspScriptSrc()}`,
    `script-src-elem ${getCspScriptSrcElem()}`,
    `style-src ${getCspStyleSrc()}`,
    `img-src ${getCspImgSrc()}`,
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
  ].join('; ');

  const headers: Record<string, string> = {
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    'Content-Security-Policy': csp,
  };

  if (IS_PRODUCTION && APP_ORIGIN.startsWith('https://')) {
    headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload';
  }

  return headers;
}

/** Apply security headers to a NextResponse. */
export function applySecurityHeaders(response: NextResponse): void {
  const headers = getSecurityHeaders();
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
}
