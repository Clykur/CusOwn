/**
 * Intermediate redirect after OAuth callback so the browser sends session cookies
 * on the next request. Callback redirects here with ?to=/path; we then redirect
 * to the target so /admin/dashboard (etc.) receives the cookies.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/supabase/server-auth';
import { ROUTES } from '@/lib/utils/navigation';

function isAllowedPath(to: string): boolean {
  const path = to.startsWith('/') ? to : `/${to}`;
  if (path.includes('//') || path.startsWith('/auth')) return false;
  return (
    path === '/' ||
    path.startsWith('/admin') ||
    path.startsWith('/owner') ||
    path.startsWith('/customer') ||
    path.startsWith('/setup') ||
    path.startsWith('/profile') ||
    path.startsWith('/book')
  );
}

/**
 * Resolve ?to= for post-OAuth redirect. Rejects open redirects and non-http(s) schemes.
 */
function normalizeOAuthRedirectTarget(rawTo: string, requestOrigin: string): string | null {
  const maxLen = 200;
  let s = rawTo.trim();
  if (!s || s.length > maxLen) return null;

  if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(s)) {
    try {
      const abs = new URL(s);
      if (abs.protocol !== 'http:' && abs.protocol !== 'https:') return null;
      const allowedOrigin = new URL(requestOrigin).origin;
      if (abs.origin !== allowedOrigin) return null;
      s = `${abs.pathname}${abs.search}${abs.hash}`;
    } catch {
      return null;
    }
  }

  if (!s.startsWith('/') || s.includes('//') || s.startsWith('/auth/')) return null;
  return isAllowedPath(s) ? s : null;
}

export async function GET(request: NextRequest) {
  const rawTo = request.nextUrl.searchParams.get('to') ?? '';
  const baseUrl = `${request.nextUrl.origin}/`;

  const safePath =
    typeof rawTo === 'string' ? normalizeOAuthRedirectTarget(rawTo, request.nextUrl.origin) : null;

  const user = await getServerUser(request);

  if (!user || !safePath) {
    return NextResponse.redirect(new URL(ROUTES.AUTH_LOGIN(), baseUrl), 303);
  }

  const targetUrl = new URL(safePath, baseUrl).toString();
  return NextResponse.redirect(targetUrl, 303);
}
