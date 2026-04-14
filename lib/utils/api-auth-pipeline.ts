/**
 * API auth pipeline: permission-based (O(1) lookup) for admin/owner; customer routes use
 * hasCustomerDashboardAccess (same capability as customer layouts).
 * getServerUser → getAuthContext → requirePermission / requireAuth.
 * [AUTH] console logs are server-side only; they appear in the terminal (npm run dev), not in the browser DevTools.
 */

import { NextRequest, NextResponse } from 'next/server';
import { CAPABILITIES } from '@/config/constants';
import { getServerUser, getServerUserProfile } from '@/lib/supabase/server-auth';
import { hasCustomerDashboardAccess } from '@/services/access.service';
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
    return null;
  }
  const profile = await getServerUserProfile(user.id);
  return { user, profile };
}

export async function requireAuth(
  request: NextRequest,
  route: string
): Promise<NextResponse | AuthContext> {
  const ctx = await getAuthContext(request);
  if (!ctx) {
    logAuthDeny({ route, reason: 'auth_missing' });
    return errorResponse('Authentication required', 401);
  }
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
    logAuthDeny({ route, reason: 'auth_missing' });
    return errorResponse('Authentication required', 401);
  }
  const allowed = await hasPermission(ctx.user.id, permissionName);
  if (!allowed) {
    logAuthDeny({
      user_id: ctx.user.id,
      route,
      reason: 'auth_denied',
      permission: permissionName,
    });
    return errorResponse('Access denied', 403);
  }
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
  const ctx = await getAuthContext(request);
  if (!ctx) {
    logAuthDeny({ route, reason: 'auth_missing' });
    return errorResponse('Authentication required', 401);
  }
  const allowed = await hasCustomerDashboardAccess(ctx.user.id);
  if (!allowed) {
    logAuthDeny({
      user_id: ctx.user.id,
      route,
      reason: 'auth_denied',
      audit_metadata: { capability: CAPABILITIES.ACCESS_CUSTOMER_DASHBOARD },
    });
    return errorResponse('Access denied', 403);
  }
  return ctx;
}

/**
 * Log invalid signed URL and return 403. Use when validateResourceToken fails.
 */
export function denyInvalidToken(
  request: NextRequest,
  route: string,
  resource?: string
): NextResponse {
  logAuthDeny({
    route,
    reason: 'auth_invalid_token',
    resource: resource ?? undefined,
  });
  return errorResponse('Invalid or expired access token', 403);
}
