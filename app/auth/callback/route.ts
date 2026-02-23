import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { env } from '@/config/env';
import { createSecureSetAll } from '@/lib/auth/cookie-adapter.server';
import { userService } from '@/services/user.service';
import { getOAuthRedirect } from '@/lib/auth/getOAuthRedirect';
import { ROUTES } from '@/lib/utils/navigation';
import { AUTH_COOKIE_MAX_AGE_SECONDS, AUTH_PENDING_ROLE_COOKIE } from '@/config/constants';

/**
 * OAuth callback: atomic profile upsert, role from cookie then query, never override admin.
 * Clears pending-role cookie after use.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const baseUrlFromRequest = getOAuthRedirect('/auth/callback', request);
  const baseUrl = `${new URL(baseUrlFromRequest).origin}/`;

  console.log('[AUTH] callback: GET', {
    hasCode: !!code,
    error: requestUrl.searchParams.get('error') ?? null,
    error_description: requestUrl.searchParams.get('error_description') ?? null,
  });

  if (!code) {
    const errDesc = requestUrl.searchParams.get('error_description');
    const errCode = requestUrl.searchParams.get('error_code');
    const err = requestUrl.searchParams.get('error');
    if (errDesc || errCode || err) {
      console.log('[AUTH] callback: negative — no code, redirect to login with error', {
        error: err ?? null,
        error_description: errDesc ?? null,
      });
      const msg = encodeURIComponent(errDesc || err || 'auth_failed');
      return NextResponse.redirect(new URL(`${ROUTES.AUTH_LOGIN()}?error=${msg}`, baseUrl));
    }
    console.log('[AUTH] callback: negative — no code, redirect to home');
    return NextResponse.redirect(new URL(ROUTES.HOME, baseUrl));
  }

  const cookieStore = await cookies();
  const cookiesToForward: { name: string; value: string; options?: Record<string, unknown> }[] = [];
  const setAll = createSecureSetAll((name, value, options) => {
    cookieStore.set(name, value, options);
    cookiesToForward.push({ name, value, options });
  });
  const supabase = createServerClient(env.supabase.url, env.supabase.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        setAll(
          cookiesToSet as { name: string; value: string; options?: Record<string, unknown> }[]
        );
      },
    },
  });

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.session || !data.user) {
    console.log('[AUTH] callback: negative — exchangeCodeForSession failed', {
      error: error?.message ?? null,
      hasSession: !!data?.session,
      hasUser: !!data?.user,
    });
    try {
      const { authEventsService } = await import('@/services/auth-events.service');
      const { getClientIp } = await import('@/lib/utils/security');
      authEventsService.insert('login_failed', {
        email: requestUrl.searchParams.get('email') ?? undefined,
        ip: getClientIp(request),
        userAgent: request.headers.get('user-agent') ?? undefined,
      });
    } catch {
      // optional logging
    }
    const msg = encodeURIComponent(error?.message || 'auth_failed');
    return NextResponse.redirect(new URL(`${ROUTES.AUTH_LOGIN()}?error=${msg}`, baseUrl));
  }

  try {
    const { authEventsService } = await import('@/services/auth-events.service');
    const { getClientIp } = await import('@/lib/utils/security');
    authEventsService.insert('login_success', {
      userId: data.user.id,
      email: data.user.email ?? undefined,
      ip: getClientIp(request),
      userAgent: request.headers.get('user-agent') ?? undefined,
    });
  } catch {
    // optional logging
  }

  console.log('[AUTH] callback: positive — session exchanged', {
    userId: data.user.id.substring(0, 8) + '...',
  });

  const pendingRoleCookie = cookieStore.get(AUTH_PENDING_ROLE_COOKIE)?.value as
    | 'owner'
    | 'customer'
    | null;
  const roleFromQuery = requestUrl.searchParams.get('role') as 'owner' | 'customer' | null;
  const selectedRole = pendingRoleCookie ?? roleFromQuery;

  let profile: Awaited<ReturnType<typeof userService.getUserProfile>> = null;
  let isNewUser = false;
  try {
    profile = await userService.getUserProfile(data.user.id);
  } catch {
    // ignore
  }

  if (profile?.user_type === 'admin') {
    console.log('[AUTH] callback: positive — redirect admin', {
      userId: data.user.id.substring(0, 8) + '...',
      target: 'admin_dashboard',
    });
    void import('@/services/audit.service').then(({ auditService }) =>
      auditService.createAuditLog(data.user.id, 'admin_login', 'user', {
        entityId: data.user.id,
        actorRole: 'admin',
      })
    );
    return redirectToSuccess(ROUTES.ADMIN_DASHBOARD, baseUrl, cookiesToForward);
  }

  try {
    const fullName = data.user.user_metadata?.full_name ?? data.user.email?.split('@')[0] ?? null;

    if (!profile) {
      isNewUser = true;
      const initialRole = selectedRole ?? 'customer';
      profile = await userService.upsertUserProfile(data.user.id, {
        full_name: fullName,
        user_type: initialRole as 'owner' | 'customer',
      });
      await userService.setUserRoles(data.user.id, [initialRole]);
    }
    // Do not mutate roles for existing users in callback; role changes only via /api/user/update-role.
  } catch {
    // retry later
  }

  const redirectTo = requestUrl.searchParams.get('redirect_to');
  if (redirectTo && !redirectTo.includes('/auth/callback')) {
    console.log('[AUTH] callback: positive — redirect to redirect_to param', {
      userId: data.user.id.substring(0, 8) + '...',
    });
    const path = redirectTo.startsWith('http') ? new URL(redirectTo).pathname : redirectTo;
    return redirectToSuccess(path, baseUrl, cookiesToForward);
  }

  try {
    const { getUserState } = await import('@/lib/utils/user-state');
    const stateResult = await getUserState(data.user.id);
    const stateRedirect = stateResult.redirectUrl;
    // Do not send customer intent to onboarding: getUserState may return /select-role for "both, no business"
    if (stateRedirect && !(stateRedirect.includes('/select-role') && selectedRole === 'customer')) {
      console.log('[AUTH] callback: positive — redirect from getUserState', {
        userId: data.user.id.substring(0, 8) + '...',
        redirectUrl: stateRedirect,
      });
      const path = stateRedirect.startsWith('http')
        ? new URL(stateRedirect).pathname
        : stateRedirect;
      return redirectToSuccess(path, baseUrl, cookiesToForward);
    }
  } catch {
    // ignore
  }

  // Customer login intent: always send to customer dashboard
  if (selectedRole === 'customer') {
    console.log('[AUTH] callback: positive — redirect customer (selected role)', {
      userId: data.user.id.substring(0, 8) + '...',
      target: 'customer_dashboard',
    });
    return redirectToSuccess(ROUTES.CUSTOMER_DASHBOARD, baseUrl, cookiesToForward);
  }
  if (profile?.user_type === 'owner' || profile?.user_type === 'both') {
    // New owner (first login, no business yet) → onboarding, not dashboard
    if (isNewUser) {
      console.log('[AUTH] callback: positive — redirect new owner to onboarding', {
        userId: data.user.id.substring(0, 8) + '...',
        target: 'select-role?role=owner',
      });
      return redirectToSuccess(ROUTES.SELECT_ROLE('owner'), baseUrl, cookiesToForward);
    }
    console.log('[AUTH] callback: positive — redirect owner/both', {
      userId: data.user.id.substring(0, 8) + '...',
      target: 'owner_dashboard',
    });
    return redirectToSuccess(ROUTES.OWNER_DASHBOARD_BASE, baseUrl, cookiesToForward);
  }
  if (profile?.user_type === 'admin') {
    return redirectToSuccess(ROUTES.ADMIN_DASHBOARD, baseUrl, cookiesToForward);
  }
  if (selectedRole === 'owner') {
    console.log('[AUTH] callback: positive — redirect onboarding (new owner)', {
      userId: data.user.id.substring(0, 8) + '...',
      target: 'select-role?role=owner',
    });
    return redirectToSuccess(ROUTES.SELECT_ROLE('owner'), baseUrl, cookiesToForward);
  }
  console.log('[AUTH] callback: positive — redirect customer (default)', {
    userId: data.user.id.substring(0, 8) + '...',
    target: 'customer_dashboard',
  });
  return redirectToSuccess(ROUTES.CUSTOMER_DASHBOARD, baseUrl, cookiesToForward);
}

/**
 * Return 200 with Set-Cookie + HTML that redirects to /auth/success?to=<path>.
 * The browser sends cookies on that GET; the success route then server-redirects to the
 * final dashboard so the dashboard request also has cookies.
 */
function redirectToSuccess(
  path: string,
  baseUrl: string,
  sessionCookies: { name: string; value: string; options?: Record<string, unknown> }[] = []
): NextResponse {
  const to = path.startsWith('/') ? path : `/${path}`;
  const successUrl = new URL(`/auth/success?to=${encodeURIComponent(to)}`, baseUrl).toString();
  const safeUrlAttr = successUrl.replace(/"/g, '&quot;');
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta http-equiv="Refresh" content="2;url=${safeUrlAttr}"/><script>
(()=>{
  var u = ${JSON.stringify(successUrl)};
  console.log('[AUTH_FLOW] Callback: redirecting in 300ms to /auth/success then dashboard');
  setTimeout(()=>{ window.location.href = u; }, 300);
})();
</script></head><body><p>Signing you in…</p><a href="${safeUrlAttr}">Continue</a></body></html>`;
  const res = new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
    },
  });
  for (const { name, value, options } of sessionCookies) {
    const opts = (options || {}) as Record<string, unknown>;
    const cookieOpts: Record<string, unknown> = {
      path: (opts.path as string) ?? '/',
      maxAge: (opts.maxAge as number) ?? AUTH_COOKIE_MAX_AGE_SECONDS,
      sameSite: (opts.sameSite as 'lax' | 'strict' | 'none') ?? 'lax',
      secure:
        opts.secure !== undefined
          ? (opts.secure as boolean)
          : process.env.NODE_ENV === 'production',
      httpOnly: opts.httpOnly !== undefined ? (opts.httpOnly as boolean) : true,
    };
    if (opts.expires != null) cookieOpts.expires = opts.expires as Date;
    res.cookies.set(name, value, cookieOpts as Parameters<NextResponse['cookies']['set']>[2]);
  }
  res.cookies.set(AUTH_PENDING_ROLE_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
  return res;
}
