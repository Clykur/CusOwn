import { NextRequest } from 'next/server';
import { errorResponse, successResponse } from '@/lib/utils/response';
import { getServerUser } from '@/lib/supabase/server-auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { ROLE_IDS, type RoleName } from '@/config/constants';
import { validateCSRFToken } from '@/lib/security/csrf';

type UpgradableRole = Extract<RoleName, 'owner' | 'customer'>;

const ALLOWED_ROLES: ReadonlySet<string> = new Set(['owner', 'customer']);

function isUpgradableRole(value: unknown): value is UpgradableRole {
  return typeof value === 'string' && ALLOWED_ROLES.has(value);
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

/**
 * POST /api/user/upgrade-role
 * Adds owner/customer role for current user only (idempotent).
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getServerUser(request);
    if (!user) {
      return errorResponse('Authentication required', 401);
    }

    const csrfValid = await validateCSRFToken(request);
    if (!csrfValid) {
      return errorResponse('Invalid CSRF token', 403);
    }

    if (!supabaseAdmin) {
      return errorResponse('Database not configured', 500);
    }

    const body = await request.json().catch(() => null);
    const requestedRole = body?.role;
    if (!isUpgradableRole(requestedRole)) {
      return errorResponse('Invalid role. Must be "customer" or "owner"', 400);
    }

    const { userService } = await import('@/services/user.service');
    const profile = await userService.getUserProfile(user.id);
    const currentRoles =
      profile?.user_type === 'both'
        ? ['customer', 'owner']
        : profile?.user_type === 'admin'
          ? ['admin']
          : profile?.user_type
            ? [profile.user_type]
            : [];

    const newRoles = Array.from(new Set([...currentRoles, requestedRole]));
    await userService.setUserRoles(user.id, newRoles);

    const updatedProfile = await userService.getUserProfile(user.id);
    const nextUserType = updatedProfile?.user_type || 'customer';

    const { invalidateProfileCache } = await import('@/lib/cache/auth-cache');
    invalidateProfileCache(user.id);

    return successResponse({
      role: requestedRole,
      user_type: nextUserType,
      roles: newRoles,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to upgrade role';
    return errorResponse(message, 500);
  }
}
