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
    path.startsWith('/profile')
  );
}

export async function GET(request: NextRequest) {
  let to = request.nextUrl.searchParams.get('to')?.trim() ?? '';
  const baseUrl = `${request.nextUrl.origin}/`;

  // Normalize: use path only (avoids doubled host if to was ever a full URL).
  if (to.startsWith('http://') || to.startsWith('https://')) {
    try {
      to = new URL(to).pathname;
    } catch {
      to = '';
    }
  }
  if (!to || !to.startsWith('/') || to.includes('//') || to.startsWith('/auth/')) {
    console.log('[AUTH] success: invalid or missing to param', { to: to || null });
    return NextResponse.redirect(new URL(ROUTES.AUTH_LOGIN(), baseUrl), 303);
  }

  if (!isAllowedPath(to)) {
    console.log('[AUTH] success: to not allowed', { to });
    return NextResponse.redirect(new URL(ROUTES.AUTH_LOGIN(), baseUrl), 303);
  }

  const user = await getServerUser(request);
  if (!user) {
    console.log('[AUTH] success: no session on intermediate request, redirect to login');
    return NextResponse.redirect(new URL(ROUTES.AUTH_LOGIN(), baseUrl), 303);
  }

  const targetUrl = new URL(to, baseUrl).toString();
  console.log('[AUTH] success: redirecting to target', {
    userId: user.id.substring(0, 8) + '...',
    to,
  });
  return NextResponse.redirect(targetUrl, 303);
}
