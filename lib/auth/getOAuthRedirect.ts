import type { NextRequest } from 'next/server';

/** In dev, localhost without port is not reachable (Next runs on 3000). Use port 3000. */
function normalizeHostForRedirect(host: string): string {
  if (process.env.NODE_ENV !== 'development') return host;
  const h = host.split(':')[0]?.toLowerCase();
  if (h === 'localhost' && !host.includes(':')) {
    return 'localhost:3000';
  }
  return host;
}

/**
 * Returns the OAuth redirect URL derived from runtime context only.
 * - Browser: window.location.origin + path
 * - Server: request Host + X-Forwarded-Proto (or request URL protocol) + path
 * In dev, Host "localhost" (no port) is normalized to localhost:3000 so redirects work.
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
    const normalizedHost = normalizeHostForRedirect(host);
    const proto =
      request.headers.get('x-forwarded-proto') ||
      (request.url ? new URL(request.url).protocol.replace(':', '') : null) ||
      'https';
    return `${proto}://${normalizedHost}${normalizedPath}`;
  }

  throw new Error('OAuth redirect origin cannot be determined: no window or request context');
}
