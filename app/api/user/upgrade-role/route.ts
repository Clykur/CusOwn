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

    const roleId = ROLE_IDS[requestedRole];
    const { error: roleInsertError } = await supabaseAdmin.from('user_roles').upsert(
      {
        user_id: user.id,
        role_id: roleId,
      },
      {
        onConflict: 'user_id,role_id',
        ignoreDuplicates: true,
      }
    );

    if (roleInsertError) {
      return errorResponse(roleInsertError.message || 'Failed to assign role', 500);
    }

    const { data: roleRows, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('roles(name)')
      .eq('user_id', user.id);

    if (rolesError) {
      return errorResponse(rolesError.message || 'Failed to load user roles', 500);
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
        id: user.id,
        user_type: nextUserType,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );

    if (profileError) {
      return errorResponse(profileError.message || 'Failed to sync user profile', 500);
    }

    const { invalidateProfileCache } = await import('@/lib/cache/auth-cache');
    invalidateProfileCache(user.id);

    return successResponse({
      role: requestedRole,
      user_type: nextUserType,
      roles: Array.from(new Set(roleNames)),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to upgrade role';
    return errorResponse(message, 500);
  }
}
