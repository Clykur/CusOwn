/**
 * Single entry auth gate for protected routes.
 * Run in server components/layouts only. Redirect before any UI to avoid flicker.
 */

import type { NextRequest } from 'next/server';
import { getServerUser, getServerUserProfile } from '@/lib/supabase/server-auth';
import { getUserState } from '@/lib/utils/user-state';
import type { UserStateResult } from '@/lib/utils/user-state';
import type { ServerUserProfileResult } from '@/lib/supabase/server-auth';
import { ROUTES } from '@/lib/utils/navigation';

export type ResolvedAuth = {
  user: { id: string; email?: string };
  profile: ServerUserProfileResult;
  state: UserStateResult;
  redirectUrl: string | null;
  /** When true, layout did not see cookies (RSC); client must verify session via /api/auth/session and redirect if needed. */
  requireClientAuthCheck?: boolean;
  permissions: {
    canAccessAdmin: boolean;
    canAccessOwner: boolean;
    canAccessCustomer: boolean;
  };
};

export type ResolveOptions = {
  /** Require specific scope; if set, redirect when user cannot access this scope. */
  requireScope?: 'admin' | 'owner' | 'customer';
  /** Base URL for redirects (default from request or headers). */
  baseUrl?: string;
};

/** In dev, localhost without port is not reachable (Next runs on 3000). Use port 3000. */
function normalizeHostForRedirect(host: string): string {
  if (process.env.NODE_ENV !== 'development') return host;
  const h = host.split(':')[0]?.toLowerCase();
  if (h === 'localhost' && !host.includes(':')) {
    return 'localhost:3000';
  }
  return host;
}

function buildBaseUrlFromHeaders(headers: Headers): string {
  const host = headers.get('x-forwarded-host') ?? headers.get('host') ?? 'localhost';
  const normalizedHost = normalizeHostForRedirect(host);
  const proto = headers.get('x-forwarded-proto') ?? 'http';
  return `${proto}://${normalizedHost}/`;
}

/**
 * Resolve user and redirect target in one place. No duplicate profile fetches.
 * Call in server layout/route; if redirectUrl is set, redirect before rendering.
 * Pass NextRequest in route handlers; omit in server layouts (uses next/headers).
 */
export async function resolveUserAndRedirect(
  requestOrContext?: NextRequest | null,
  options?: ResolveOptions
): Promise<ResolvedAuth> {
  let baseUrl: string;
  let request: Request | undefined;

  if (requestOrContext && 'url' in requestOrContext) {
    baseUrl = options?.baseUrl ?? `${new URL(requestOrContext.url).origin}/`;
    request = requestOrContext as Request;
  } else {
    const { headers } = await import('next/headers');
    const headersList = await headers();
    baseUrl = options?.baseUrl ?? buildBaseUrlFromHeaders(headersList);
    request = new Request(baseUrl, { headers: headersList as unknown as Headers });
  }

  const requireScope = options?.requireScope;

  const user = await getServerUser(request);
  const isLayoutContext = !requestOrContext || !('url' in requestOrContext);

  if (!user) {
    const pathname =
      request && 'nextUrl' in request ? (request as NextRequest).nextUrl.pathname : undefined;
    let loginPath =
      typeof ROUTES.AUTH_LOGIN === 'function' ? ROUTES.AUTH_LOGIN(pathname) : '/auth/login';
    const loginUrl = new URL(loginPath, baseUrl);
    loginUrl.searchParams.set('redirect_from', 'guard');
    const redirectToLogin = loginUrl.toString();

    if (isLayoutContext) {
      // Layout often cannot see cookies (RSC). Do not redirect; let client verify session and redirect.
      if (process.env.NODE_ENV === 'development') {
        console.log(
          '[AUTH] resolveUserAndRedirect: no user in layout context — require client auth check'
        );
      }
      return {
        user: { id: '' },
        profile: null,
        state: {
          state: 'S0',
          authenticated: false,
          profileExists: false,
          userType: null,
          businessCount: 0,
          redirectUrl: redirectToLogin,
          reason: 'unauthenticated',
          canAccessOwnerDashboard: false,
          canAccessCustomerDashboard: false,
          canAccessSetup: false,
          canAccessAdminDashboard: false,
        },
        redirectUrl: null,
        requireClientAuthCheck: true,
        permissions: {
          canAccessAdmin: false,
          canAccessOwner: false,
          canAccessCustomer: false,
        },
      };
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('[AUTH] resolveUserAndRedirect: no user, redirect to login', {
        attemptedPath: pathname,
        loginUrl: redirectToLogin,
      });
    }
    return {
      user: { id: '' },
      profile: null,
      state: {
        state: 'S0',
        authenticated: false,
        profileExists: false,
        userType: null,
        businessCount: 0,
        redirectUrl: redirectToLogin,
        reason: 'unauthenticated',
        canAccessOwnerDashboard: false,
        canAccessCustomerDashboard: false,
        canAccessSetup: false,
        canAccessAdminDashboard: false,
      },
      redirectUrl: redirectToLogin,
      permissions: {
        canAccessAdmin: false,
        canAccessOwner: false,
        canAccessCustomer: false,
      },
    };
  }

  const profile = await getServerUserProfile(user.id);
  const state = await getUserState(user.id, { skipCache: true });

  const permissions = {
    canAccessAdmin: state.canAccessAdminDashboard,
    canAccessOwner: state.canAccessOwnerDashboard,
    canAccessCustomer: state.canAccessCustomerDashboard,
  };

  let redirectUrl: string | null = state.redirectUrl
    ? new URL(state.redirectUrl, baseUrl).toString()
    : null;

  if (!profile && !redirectUrl) {
    redirectUrl = new URL(ROUTES.SELECT_ROLE(), baseUrl).toString();
  }

  if (requireScope === 'admin' && !permissions.canAccessAdmin) {
    void import('@/services/audit.service').then(({ auditService }) =>
      auditService.createAuditLog(user.id, 'admin_access_denied', 'user', {
        entityId: user.id,
        description: 'Attempted admin area access without admin role',
        request: request as import('next/server').NextRequest,
      })
    );
    redirectUrl = redirectUrl ?? new URL(state.redirectUrl ?? ROUTES.HOME, baseUrl).toString();
  }
  if (requireScope === 'owner' && !permissions.canAccessOwner) {
    redirectUrl = redirectUrl ?? new URL(state.redirectUrl ?? ROUTES.HOME, baseUrl).toString();
  }
  if (requireScope === 'customer' && !permissions.canAccessCustomer) {
    redirectUrl = redirectUrl ?? new URL(state.redirectUrl ?? ROUTES.HOME, baseUrl).toString();
  }

  if (process.env.NODE_ENV === 'development' && redirectUrl) {
    console.log('[AUTH] resolveUserAndRedirect: redirecting', {
      scope: requireScope,
      userId: user.id.substring(0, 8) + '...',
      redirectUrl,
    });
  }

  return {
    user: { id: user.id, email: user.email ?? undefined },
    profile,
    state,
    redirectUrl,
    permissions,
  };
}
