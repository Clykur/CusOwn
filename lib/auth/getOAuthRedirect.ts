import type { NextRequest } from 'next/server';

/**
 * Returns the OAuth redirect URL derived from runtime context only.
 * - Browser: window.location.origin + path
 * - Server: request Host + X-Forwarded-Proto (or request URL protocol) + path
 * No env vars or production fallbacks.
 */
export function getOAuthRedirect(path: string = '/auth/callback', request?: NextRequest): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (typeof window !== 'undefined' && window?.location?.origin) {
    return `${window.location.origin}${normalizedPath}`;
  }

  if (request) {
    const host = request.headers.get('host');
    if (!host) {
      throw new Error('OAuth redirect: missing Host header');
    }
    const proto =
      request.headers.get('x-forwarded-proto') ||
      (request.url ? new URL(request.url).protocol.replace(':', '') : null) ||
      'https';
    return `${proto}://${host}${normalizedPath}`;
  }

  throw new Error('OAuth redirect origin cannot be determined: no window or request context');
}
