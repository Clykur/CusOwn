/**
 * Server-only auth: initiate Google OAuth. Frontend navigates here; server redirects to provider.
 * Sets pending-role cookie when role= is present; callback reads and clears it.
 *
 * Platform-switch guard: if a session already exists for the opposite platform, the user
 * is redirected back to the login page with a clear message rather than starting a new
 * OAuth flow that would silently overwrite or conflict with the active session.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@cusown/shared/server';
import { getOAuthRedirect } from '@cusown/shared/server';
import { ROUTES } from '@cusown/shared/server';
import { AUTH_PENDING_ROLE_COOKIE, AUTH_PENDING_ROLE_MAX_AGE_SECONDS } from '@cusown/config';

const ALLOWED_ROLES = ['owner', 'customer'];

/** Map user_type to the platform role family for conflict detection. */
function getPlatformFamily(userType: string | null): 'owner' | 'customer' | 'both' | null {
  if (!userType) return null;
  if (userType === 'admin') return null; // admins are exempt
  if (userType === 'both') return 'both';
  if (userType === 'owner') return 'owner';
  return 'customer';
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const redirectTo = requestUrl.searchParams.get('redirect_to') || '';
  const roleParam = requestUrl.searchParams.get('role');
  const role =
    typeof roleParam === 'string' && ALLOWED_ROLES.includes(roleParam.toLowerCase())
      ? (roleParam.toLowerCase() as 'owner' | 'customer')
      : null;

  console.log('[AUTH] login GET', {
    role: role ?? null,
    hasRedirectTo: !!redirectTo,
  });

  // ── Platform-switch guard ────────────────────────────────────────────────────
  // If the user already has an active session AND is trying to access the
  // opposite platform, redirect them back with an informative error message.
  if (role) {
    try {
      const supabaseCheck = await createServerClient();
      const {
        data: { user: existingUser },
      } = await supabaseCheck.auth.getUser();

      if (existingUser) {
        // Fetch their profile to get current user_type
        const { data: profileRow } = await supabaseCheck
          .from('user_profiles')
          .select('user_type')
          .eq('id', existingUser.id)
          .single();

        const currentType = (profileRow as { user_type?: string } | null)?.user_type ?? null;
        const platform = getPlatformFamily(currentType);

        // 'both' users can freely access either platform — no block needed.
        if (platform && platform !== 'both') {
          const isConflict =
            (role === 'owner' && platform === 'customer') ||
            (role === 'customer' && platform === 'owner');

          if (isConflict) {
            const platformLabel = platform === 'owner' ? 'Owner' : 'Customer';
            const targetLabel = role === 'owner' ? 'Owner' : 'Customer';
            const msg = encodeURIComponent(
              `You are currently signed in to the ${platformLabel} platform. ` +
                `To access the ${targetLabel} platform, please sign out first.`
            );
            const loginBase =
              typeof ROUTES.AUTH_LOGIN === 'function' ? ROUTES.AUTH_LOGIN() : '/auth/login';
            const loginUrl = new URL(`${loginBase}?error=${msg}`, requestUrl.origin);
            loginUrl.searchParams.set('role', role);
            console.log('[AUTH] login: platform-switch blocked', {
              currentPlatform: platform,
              requestedRole: role,
            });
            return NextResponse.redirect(loginUrl);
          }
        }
      }
    } catch (err) {
      // Best-effort guard — if session check fails, proceed normally.
      console.warn('[AUTH] login: platform-switch guard error (non-fatal)', err);
    }
  }
  // ────────────────────────────────────────────────────────────────────────────

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

  console.log('[AUTH] login: positive — redirecting to provider', {
    targetUrl: data.url,
    callbackUrl,
  });

  return NextResponse.redirect(data.url, {
    status: 302,
  });
}
