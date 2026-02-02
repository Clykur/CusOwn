/**
 * API auth pipeline: single source of truth for route auth.
 * Order: getServerUser → fetch profile once → role guard → scoped resource check.
 * O(1) per request; no N+1 profile/role queries.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerUser, getServerUserProfile } from '@/lib/supabase/server-auth';
import { checkIsAdmin } from '@/lib/utils/admin';
import {
  isAdminProfile,
  hasOwnerProfile,
  hasCustomerProfile,
  type ProfileLike,
} from '@/lib/utils/role-verification';
import { adminRateLimit } from '@/lib/security/rate-limit-api.security';
import { logAuthDeny } from '@/lib/monitoring/auth-audit';
import { errorResponse } from '@/lib/utils/response';

export type AuthContext = {
  user: { id: string };
  profile: ProfileLike | null;
};

/**
 * Fetch user + profile once (O(1) per request). Use in every API route that needs auth.
 */
export async function getAuthContext(request: NextRequest): Promise<AuthContext | null> {
  const user = await getServerUser(request);
  if (!user) return null;
  const profile = await getServerUserProfile(user.id);
  return { user, profile };
}

/**
 * Require authenticated user. Returns 401 + log auth_missing if no user.
 */
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
 * Require admin: adminRateLimit → getServerUser → checkIsAdmin.
 * Returns 401 if no user, 403 if not admin. All /api/admin/* must use this.
 */
export async function requireAdmin(
  request: NextRequest,
  route: string
): Promise<NextResponse | AuthContext> {
  const rateLimitResponse = await adminRateLimit(request);
  if (rateLimitResponse) return rateLimitResponse;

  const ctx = await getAuthContext(request);
  if (!ctx) {
    logAuthDeny({ route, reason: 'auth_missing' });
    return errorResponse('Authentication required', 401);
  }
  const isAdmin = await checkIsAdmin(ctx.user.id, ctx.profile);
  if (!isAdmin) {
    logAuthDeny({
      user_id: ctx.user.id,
      route,
      reason: 'auth_denied',
      role: (ctx.profile as any)?.user_type ?? 'unknown',
    });
    return errorResponse('Admin access required', 403);
  }
  return ctx;
}

/**
 * Require owner role (owner, both, or admin). Returns 401 or 403 with log.
 */
export async function requireOwner(
  request: NextRequest,
  route: string
): Promise<NextResponse | AuthContext> {
  const ctx = await getAuthContext(request);
  if (!ctx) {
    logAuthDeny({ route, reason: 'auth_missing' });
    return errorResponse('Authentication required', 401);
  }
  if (!hasOwnerProfile(ctx.profile)) {
    logAuthDeny({
      user_id: ctx.user.id,
      route,
      reason: 'auth_denied',
      role: (ctx.profile as any)?.user_type ?? 'unknown',
    });
    return errorResponse('Access denied', 403);
  }
  return ctx;
}

/**
 * Require customer role (customer, both, or admin). Returns 401 or 403 with log.
 */
export async function requireCustomer(
  request: NextRequest,
  route: string
): Promise<NextResponse | AuthContext> {
  const ctx = await getAuthContext(request);
  if (!ctx) {
    logAuthDeny({ route, reason: 'auth_missing' });
    return errorResponse('Authentication required', 401);
  }
  if (!hasCustomerProfile(ctx.profile)) {
    logAuthDeny({
      user_id: ctx.user.id,
      route,
      reason: 'auth_denied',
      role: (ctx.profile as any)?.user_type ?? 'unknown',
    });
    return errorResponse('Access denied', 403);
  }
  return ctx;
}

/**
 * Log invalid signed URL and return 403. Use when validateResourceToken fails.
 */
export function denyInvalidToken(request: NextRequest, route: string, resource?: string): NextResponse {
  logAuthDeny({
    route,
    reason: 'auth_invalid_token',
    resource: resource ?? undefined,
  });
  return errorResponse('Invalid or expired access token', 403);
}
