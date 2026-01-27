import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { env } from '@/config/env';
import { userService } from '@/services/user.service';
import { getBaseUrl } from '@/lib/utils/url';
import { ROUTES } from '@/lib/utils/navigation';

/**
 * OAuth callback handler (server-side).
 *
 * IMPORTANT: This must be a route handler (not a page) so PKCE code verifier
 * can be read from cookies and exchanged securely server-side.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const baseUrl = getBaseUrl(request);

  // If no code, just go home
  if (!code) {
    return NextResponse.redirect(new URL(ROUTES.HOME, baseUrl));
  }

  // Create Supabase SSR client using cookies (stores PKCE verifier + session here)
  const cookieStore = await cookies();
  const supabase = createServerClient(env.supabase.url, env.supabase.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      },
    },
  });

  // Exchange code for session (requires PKCE code verifier cookie)
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.session || !data.user) {
    const msg = encodeURIComponent(error?.message || 'auth_failed');
    return NextResponse.redirect(new URL(`${ROUTES.AUTH_LOGIN}?error=${msg}`, baseUrl));
  }

  // Role passed during OAuth start (optional)
  const selectedRole = requestUrl.searchParams.get('role') as 'owner' | 'customer' | null;

  // Admin users should never be downgraded/changed by onboarding
  let profile: any = null;
  try {
    profile = await userService.getUserProfile(data.user.id);
    if (profile?.user_type === 'admin') {
      return NextResponse.redirect(new URL(ROUTES.ADMIN_DASHBOARD, baseUrl));
    }
  } catch {
    // ignore
  }

  // Ensure user profile exists (only if not admin)
  try {
    if (!profile) {
      const userType = selectedRole || 'customer';
      profile = await userService.upsertUserProfile(data.user.id, {
        full_name: data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || null,
        user_type: userType,
      });
    } else if (selectedRole && profile.user_type !== 'admin') {
      const currentType = profile.user_type;
      let newType: 'owner' | 'customer' | 'both' | 'admin' = selectedRole;

      if (currentType === 'owner' && selectedRole === 'customer') newType = 'both';
      if (currentType === 'customer' && selectedRole === 'owner') newType = 'both';
      if (currentType === 'both') newType = 'both';

      if (newType !== currentType) {
        profile = await userService.updateUserType(data.user.id, newType);
      }
    }
  } catch {
    // profile creation can be retried later
  }

  // redirect_to takes precedence (must not loop back to callback)
  const redirectTo = requestUrl.searchParams.get('redirect_to');
  if (redirectTo && !redirectTo.includes('/auth/callback')) {
    const redirectUrl = redirectTo.startsWith('http')
      ? redirectTo
      : new URL(redirectTo, baseUrl).toString();
    return NextResponse.redirect(redirectUrl);
  }

  // Use canonical user state system if available
  try {
    const { getUserState } = await import('@/lib/utils/user-state');
    const stateResult = await getUserState(data.user.id);
    if (stateResult.redirectUrl) {
      return NextResponse.redirect(new URL(stateResult.redirectUrl, baseUrl));
    }
  } catch {
    // ignore
  }

  // Fallback redirects
  if (selectedRole === 'owner') return NextResponse.redirect(new URL(ROUTES.SETUP, baseUrl));
  return NextResponse.redirect(new URL(ROUTES.CUSTOMER_DASHBOARD, baseUrl));
}
