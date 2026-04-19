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

export async function GET(request: NextRequest) {
  const rawTo = request.nextUrl.searchParams.get('to') ?? '';
  const baseUrl = `${request.nextUrl.origin}/`;

  let safePath: string | null = null;

  if (typeof rawTo === 'string' && rawTo.length <= 200) {
    let normalized = rawTo.trim();

    // Convert absolute URL → pathname only
    if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
      try {
        normalized = new URL(normalized).pathname;
      } catch {
        normalized = '';
      }
    }

    // Basic structural validation
    if (
      normalized &&
      normalized.startsWith('/') &&
      !normalized.includes('//') &&
      !normalized.startsWith('/auth/')
    ) {
      // Whitelist validation
      if (isAllowedPath(normalized)) {
        safePath = normalized;
      }
    }
  }

  const user = await getServerUser(request);

  if (!user || !safePath) {
    return NextResponse.redirect(new URL(ROUTES.AUTH_LOGIN(), baseUrl), 303);
  }

  const targetUrl = new URL(safePath, baseUrl).toString();
  return NextResponse.redirect(targetUrl, 303);
}
