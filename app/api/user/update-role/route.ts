import { NextRequest } from 'next/server';
import { getClientIp } from '@/lib/utils/security';
import { getServerUser } from '@/lib/supabase/server-auth';
import { userService } from '@/services/user.service';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { getRoles } from '@/services/access.service';
import { auditService } from '@/services/audit.service';

/**
 * POST /api/user/update-role
 * Set user roles (owner/customer or both). Writes user_roles; syncs user_type for RLS. Audit logged.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getServerUser(request);

    if (!user) {
      return errorResponse('Authentication required', 401);
    }

    const clientIP = getClientIp(request);

    const body = await request.json();
    const { role } = body;

    if (!role || (role !== 'owner' && role !== 'customer')) {
      console.warn(
        `[SECURITY] Invalid role update request from IP: ${clientIP}, User: ${user.id.substring(0, 8)}...`
      );
      return errorResponse('Invalid role. Must be "owner" or "customer"', 400);
    }

    const profile = await userService.getUserProfile(user.id);
    const currentType = profile?.user_type || 'customer';

    if (currentType === 'admin') {
      console.warn(
        `[SECURITY] Attempted role change from admin by IP: ${clientIP}, User: ${user.id.substring(0, 8)}...`
      );
      return errorResponse('Admin role cannot be changed', 403);
    }

    if (role === 'admin') {
      console.warn(
        `[SECURITY] Attempted admin role escalation from IP: ${clientIP}, User: ${user.id.substring(0, 8)}...`
      );
      return errorResponse('Cannot set role to admin', 403);
    }

    const previousRoles = await getRoles(user.id);

    let newType: 'owner' | 'customer' | 'both' = role;
    if (currentType === 'owner' && role === 'customer') newType = 'both';
    else if (currentType === 'customer' && role === 'owner') newType = 'both';
    else if (currentType === 'both') newType = 'both';

    await userService.updateUserType(user.id, newType);

    const newRoles = await getRoles(user.id);

    const { invalidateProfileCache } = await import('@/lib/cache/auth-cache');
    invalidateProfileCache(user.id);

    try {
      await auditService.createAuditLog(user.id, 'role_changed', 'user', {
        entityId: user.id,
        description: 'User roles updated',
        oldData: { roles: previousRoles, user_type: currentType },
        newData: { roles: newRoles, user_type: newType },
        request,
      });
    } catch (auditErr) {
      console.error('[SECURITY] Failed to create audit log for role change:', auditErr);
    }

    console.log(
      `[SECURITY] User role updated: IP: ${clientIP}, User: ${user.id.substring(0, 8)}..., From: ${currentType}, To: ${newType}`
    );

    return successResponse({
      user_type: newType,
      message:
        'Role updated successfully. Redirect will be handled by the application based on your current state.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update role';
    return errorResponse(message, 500);
  }
}
