/**
 * Server-only auth: initiate Google OAuth. Frontend navigates here; server redirects to provider.
 * Sets pending-role cookie when role= is present; callback reads and clears it.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@/lib/supabase/server-auth';
import { getOAuthRedirect } from '@/lib/auth/getOAuthRedirect';
import { ROUTES } from '@/lib/utils/navigation';
import { AUTH_PENDING_ROLE_COOKIE, AUTH_PENDING_ROLE_MAX_AGE_SECONDS } from '@/config/constants';

const ALLOWED_ROLES = ['owner', 'customer'];

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const redirectTo = requestUrl.searchParams.get('redirect_to') || '';
  const roleParam = requestUrl.searchParams.get('role');
  const role =
    typeof roleParam === 'string' && ALLOWED_ROLES.includes(roleParam.toLowerCase())
      ? roleParam.toLowerCase()
      : null;

  console.log('[AUTH] login GET', {
    role: role ?? null,
    hasRedirectTo: !!redirectTo,
  });

  const cookieStore = await cookies();
  if (role) {
    cookieStore.set(AUTH_PENDING_ROLE_COOKIE, role, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: AUTH_PENDING_ROLE_MAX_AGE_SECONDS,
      path: '/',
    });
  }

  let callbackUrl = getOAuthRedirect('/auth/callback', request);
  if (redirectTo && !redirectTo.includes('/auth/callback')) {
    const separator = callbackUrl.includes('?') ? '&' : '?';
    callbackUrl += `${separator}redirect_to=${encodeURIComponent(redirectTo)}`;
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: callbackUrl,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });

  if (error || !data?.url) {
    console.log('[AUTH] login: negative — OAuth error or no url', {
      error: error?.message ?? null,
      hasUrl: !!data?.url,
    });
    const msg = encodeURIComponent(error?.message || 'login_failed');
    return NextResponse.redirect(
      new URL(
        `${typeof ROUTES.AUTH_LOGIN === 'function' ? ROUTES.AUTH_LOGIN() : '/auth/login'}?error=${msg}`,
        requestUrl.origin
      )
    );
  }

  console.log('[AUTH] login: positive — redirecting to provider');
  return NextResponse.redirect(data.url);
}
