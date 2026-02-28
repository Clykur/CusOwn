import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { env } from '@/config/env';
import { createSecureSetAll } from '@/lib/auth/cookie-adapter.server';
import { userService } from '@/services/user.service';
import { getOAuthRedirect } from '@/lib/auth/getOAuthRedirect';
import { ROUTES } from '@/lib/utils/navigation';
import {
  AUTH_COOKIE_MAX_AGE_SECONDS,
  AUTH_PENDING_ROLE_COOKIE,
  ROLE_IDS,
} from '@/config/constants';
import { supabaseAdmin } from '@/lib/supabase/server';

const IS_SECURE_COOKIE_DEFAULT = new URL(env.app.baseUrl).protocol === 'https:';
const ALLOWED_ROLES = new Set(['owner', 'customer']);

type SelectableRole = 'owner' | 'customer';

function toSelectableRole(value: string | null): SelectableRole | null {
  if (!value) return null;
  const normalized = value.toLowerCase();
  return ALLOWED_ROLES.has(normalized) ? (normalized as SelectableRole) : null;
}

function toUserType(roleNames: string[]): 'admin' | 'owner' | 'customer' | 'both' {
  const hasAdmin = roleNames.includes('admin');
  if (hasAdmin) return 'admin';
  const hasOwner = roleNames.includes('owner');
  const hasCustomer = roleNames.includes('customer');
  if (hasOwner && hasCustomer) return 'both';
  if (hasOwner) return 'owner';
  return 'customer';
}

async function ensureUserHasSelectedRole(
  userId: string,
  role: SelectableRole,
  currentUserType: 'admin' | 'owner' | 'customer' | 'both' | null
): Promise<'admin' | 'owner' | 'customer' | 'both' | null> {
  if (currentUserType === 'admin' || !supabaseAdmin) return currentUserType;

  const alreadyHasRole =
    (role === 'owner' && (currentUserType === 'owner' || currentUserType === 'both')) ||
    (role === 'customer' && (currentUserType === 'customer' || currentUserType === 'both'));
  if (alreadyHasRole) return currentUserType;

  const { error: roleInsertError } = await supabaseAdmin.from('user_roles').upsert(
    {
      user_id: userId,
      role_id: ROLE_IDS[role],
    },
    {
      onConflict: 'user_id,role_id',
      ignoreDuplicates: true,
    }
  );

  if (roleInsertError) {
    console.warn('[AUTH] callback: role upsert failed, continuing with existing type', {
      userId: userId.substring(0, 8) + '...',
      role,
      error: roleInsertError.message,
    });
    return currentUserType;
  }

  const { data: roleRows, error: rolesError } = await supabaseAdmin
    .from('user_roles')
    .select('roles(name)')
    .eq('user_id', userId);

  if (rolesError) {
    console.warn('[AUTH] callback: failed to load user roles after upsert', {
      userId: userId.substring(0, 8) + '...',
      role,
      error: rolesError.message,
    });
    return currentUserType;
  }

  const roleNames = (roleRows ?? [])
    .map((row: { roles: { name: string } | { name: string }[] | null }) => {
      const joined = row.roles;
      if (Array.isArray(joined)) return joined[0]?.name;
      return joined?.name;
    })
    .filter((name): name is string => typeof name === 'string');

  const nextUserType = toUserType(roleNames);

  const { error: profileError } = await supabaseAdmin.from('user_profiles').upsert(
    {
      id: userId,
      user_type: nextUserType,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );

  if (profileError) {
    console.warn('[AUTH] callback: failed to sync user profile after role upsert', {
      userId: userId.substring(0, 8) + '...',
      role,
      error: profileError.message,
    });
    return currentUserType;
  }

  try {
    const { invalidateProfileCache } = await import('@/lib/cache/auth-cache');
    invalidateProfileCache(userId);
  } catch {
    // best-effort
  }

  return nextUserType;
}

/**
 * OAuth callback: database-driven post-login routing.
 * Redirect decisions are based only on user_profiles.user_type and business existence.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const queryRole = toSelectableRole(requestUrl.searchParams.get('role'));
  const baseUrlFromRequest = getOAuthRedirect('/auth/callback', request);
  const baseUrl = `${new URL(baseUrlFromRequest).origin}/`;

  console.info('[AUTH] callback: GET', {
    hasCode: !!code,
    error: requestUrl.searchParams.get('error') ?? null,
    error_description: requestUrl.searchParams.get('error_description') ?? null,
  });

  if (!code) {
    const errDesc = requestUrl.searchParams.get('error_description');
    const errCode = requestUrl.searchParams.get('error_code');
    const err = requestUrl.searchParams.get('error');
    if (errDesc || errCode || err) {
      console.info('[AUTH] callback: negative — no code, redirect to login with error', {
        error: err ?? null,
        error_description: errDesc ?? null,
      });
      const msg = encodeURIComponent(errDesc || err || 'auth_failed');
      return NextResponse.redirect(new URL(`${ROUTES.AUTH_LOGIN()}?error=${msg}`, baseUrl));
    }
    console.info('[AUTH] callback: negative — no code, redirect to home');
    return NextResponse.redirect(new URL(ROUTES.HOME, baseUrl));
  }

  const cookieStore = await cookies();
  const pendingRoleFromCookie = toSelectableRole(
    cookieStore.get(AUTH_PENDING_ROLE_COOKIE)?.value ?? null
  );
  const selectedRole = pendingRoleFromCookie ?? queryRole;
  const cookiesToForward: {
    name: string;
    value: string;
    options?: Record<string, unknown>;
  }[] = [];
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
          cookiesToSet as {
            name: string;
            value: string;
            options?: Record<string, unknown>;
          }[]
        );
      },
    },
  });

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.session || !data.user) {
    console.info('[AUTH] callback: negative — exchangeCodeForSession failed', {
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

  console.info('[AUTH] callback: positive — session exchanged', {
    userId: data.user.id.substring(0, 8) + '...',
  });

  let profile: Awaited<ReturnType<typeof userService.getUserProfile>> = null;
  try {
    profile = await userService.getUserProfile(data.user.id);
  } catch {
    // ignore
  }

  try {
    const fullName = data.user.user_metadata?.full_name ?? data.user.email?.split('@')[0] ?? null;

    if (!profile) {
      profile = await userService.upsertUserProfile(data.user.id, {
        full_name: fullName,
      });
    }
  } catch {
    // profile upsert is best-effort; continue with DB state checks below
  }

  let latestProfile: Awaited<ReturnType<typeof userService.getUserProfile>> = null;
  let hasBusiness = false;
  try {
    [latestProfile, hasBusiness] = await Promise.all([
      userService.getUserProfile(data.user.id),
      userService.userOwnsBusinesses(data.user.id),
    ]);
  } catch {
    latestProfile = profile;
    hasBusiness = false;
  }

  const userType = latestProfile?.user_type ?? null;

  const roleUserType = selectedRole
    ? await ensureUserHasSelectedRole(data.user.id, selectedRole, userType)
    : userType;

  if (selectedRole === 'owner' && roleUserType !== 'admin') {
    const target = hasBusiness ? ROUTES.OWNER_DASHBOARD_BASE : ROUTES.OWNER_SETUP;
    console.info('[AUTH] callback: positive — redirect selected owner path', {
      userId: data.user.id.substring(0, 8) + '...',
      target: hasBusiness ? 'owner_dashboard' : 'owner_onboarding',
    });
    return redirectToSuccess(target, baseUrl, cookiesToForward, true);
  }

  if (selectedRole === 'customer' && roleUserType !== 'admin') {
    console.info('[AUTH] callback: positive — redirect selected customer path', {
      userId: data.user.id.substring(0, 8) + '...',
      target: 'customer_dashboard',
    });
    return redirectToSuccess(ROUTES.CUSTOMER_DASHBOARD, baseUrl, cookiesToForward, true);
  }

  if (roleUserType === 'admin') {
    console.info('[AUTH] callback: positive — redirect admin', {
      userId: data.user.id.substring(0, 8) + '...',
      target: 'admin_dashboard',
    });
    void import('@/services/audit.service').then(({ auditService }) =>
      auditService.createAuditLog(data.user.id, 'admin_login', 'user', {
        entityId: data.user.id,
        actorRole: 'admin',
      })
    );
    return redirectToSuccess(ROUTES.ADMIN_DASHBOARD, baseUrl, cookiesToForward, true);
  }

  if (roleUserType === 'owner' || roleUserType === 'both') {
    const target = hasBusiness ? ROUTES.OWNER_DASHBOARD_BASE : ROUTES.OWNER_SETUP;
    console.info('[AUTH] callback: positive — redirect owner path', {
      userId: data.user.id.substring(0, 8) + '...',
      target: hasBusiness ? 'owner_dashboard' : 'owner_onboarding',
    });
    return redirectToSuccess(target, baseUrl, cookiesToForward, true);
  }

  console.info('[AUTH] callback: positive — redirect customer (default)', {
    userId: data.user.id.substring(0, 8) + '...',
    target: 'customer_dashboard',
  });
  return redirectToSuccess(ROUTES.CUSTOMER_DASHBOARD, baseUrl, cookiesToForward, true);
}

/**
 * Redirect to final destination and forward auth cookies set during session exchange.
 */
function redirectToSuccess(
  path: string,
  baseUrl: string,
  sessionCookies: {
    name: string;
    value: string;
    options?: Record<string, unknown>;
  }[] = [],
  clearPendingRole = false
): NextResponse {
  const to = path.startsWith('/') ? path : `/${path}`;
  const redirectUrl = new URL(to, baseUrl);

  const res = NextResponse.redirect(redirectUrl, { status: 302 });

  for (const { name, value, options } of sessionCookies) {
    const opts = (options || {}) as Record<string, unknown>;
    res.cookies.set(name, value, {
      path: (opts.path as string) ?? '/',
      maxAge: (opts.maxAge as number) ?? AUTH_COOKIE_MAX_AGE_SECONDS,
      sameSite: (opts.sameSite as 'lax' | 'strict' | 'none') ?? 'lax',
      secure: opts.secure !== undefined ? (opts.secure as boolean) : IS_SECURE_COOKIE_DEFAULT,
      httpOnly: opts.httpOnly !== undefined ? (opts.httpOnly as boolean) : true,
      ...(opts.expires ? { expires: opts.expires as Date } : {}),
    });
  }

  if (clearPendingRole) {
    res.cookies.set(AUTH_PENDING_ROLE_COOKIE, '', {
      path: '/',
      maxAge: 0,
      sameSite: 'lax',
      secure: IS_SECURE_COOKIE_DEFAULT,
      httpOnly: true,
    });
  }

  return res;
}
