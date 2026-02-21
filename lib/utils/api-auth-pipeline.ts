/**
 * API auth pipeline: permission-based (O(1) lookup). No hardcoded role strings.
 * getServerUser → getAuthContext → requirePermission / requireAuth.
 * [AUTH] console logs are server-side only; they appear in the terminal (npm run dev), not in the browser DevTools.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerUser, getServerUserProfile } from '@/lib/supabase/server-auth';
import { hasPermission, PERMISSIONS } from '@/services/permission.service';
import type { ProfileLike } from '@/lib/utils/role-verification';
import { logAuthDeny } from '@/lib/monitoring/auth-audit';
import { errorResponse } from '@/lib/utils/response';

export type AuthContext = {
  user: { id: string };
  profile: ProfileLike | null;
};

export async function getAuthContext(request: NextRequest): Promise<AuthContext | null> {
  const user = await getServerUser(request);
  if (!user) {
    console.log('[AUTH] getAuthContext: no user', { hasRequest: !!request });
    return null;
  }
  const profile = await getServerUserProfile(user.id);
  console.log('[AUTH] getAuthContext: ok', {
    userId: user.id.substring(0, 8) + '...',
    hasProfile: !!profile,
    userType: (profile as { user_type?: string } | null)?.user_type ?? null,
  });
  return { user, profile };
}

export async function requireAuth(
  request: NextRequest,
  route: string
): Promise<NextResponse | AuthContext> {
  const ctx = await getAuthContext(request);
  if (!ctx) {
    console.log('[AUTH] requireAuth: denied (missing)', { route });
    logAuthDeny({ route, reason: 'auth_missing' });
    return errorResponse('Authentication required', 401);
  }
  console.log('[AUTH] requireAuth: ok', { route, userId: ctx.user.id.substring(0, 8) + '...' });
  return ctx;
}

/**
 * Require permission by name (dynamic lookup). O(1) after user roles loaded.
 */
export async function requirePermission(
  request: NextRequest,
  route: string,
  permissionName: string
): Promise<NextResponse | AuthContext> {
  const ctx = await getAuthContext(request);
  if (!ctx) {
    console.log('[AUTH] requirePermission: denied (missing)', {
      route,
      permission: permissionName,
    });
    logAuthDeny({ route, reason: 'auth_missing' });
    return errorResponse('Authentication required', 401);
  }
  const allowed = await hasPermission(ctx.user.id, permissionName);
  if (!allowed) {
    console.log('[AUTH] requirePermission: denied (forbidden)', {
      route,
      permission: permissionName,
      userId: ctx.user.id.substring(0, 8) + '...',
    });
    logAuthDeny({ user_id: ctx.user.id, route, reason: 'auth_denied', permission: permissionName });
    return errorResponse('Access denied', 403);
  }
  console.log('[AUTH] requirePermission: ok', {
    route,
    permission: permissionName,
    userId: ctx.user.id.substring(0, 8) + '...',
  });
  return ctx;
}

export async function requireAdmin(
  request: NextRequest,
  route: string
): Promise<NextResponse | AuthContext> {
  return requirePermission(request, route, PERMISSIONS.ADMIN_ACCESS);
}

export async function requireOwner(
  request: NextRequest,
  route: string
): Promise<NextResponse | AuthContext> {
  return requirePermission(request, route, PERMISSIONS.BUSINESSES_READ);
}

export async function requireCustomer(
  request: NextRequest,
  route: string
): Promise<NextResponse | AuthContext> {
  return requirePermission(request, route, PERMISSIONS.BOOKINGS_READ);
}

/**
 * Log invalid signed URL and return 403. Use when validateResourceToken fails.
 */
export function denyInvalidToken(
  request: NextRequest,
  route: string,
  resource?: string
): NextResponse {
  console.log('[AUTH] denyInvalidToken: invalid or expired token', {
    route,
    resource: resource ?? null,
  });
  logAuthDeny({
    route,
    reason: 'auth_invalid_token',
    resource: resource ?? undefined,
  });
  return errorResponse('Invalid or expired access token', 403);
}
