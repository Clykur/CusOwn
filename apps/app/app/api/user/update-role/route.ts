import { NextRequest } from 'next/server';
import {
  getClientIp,
  requireAuth,
  userService,
  successResponse,
  errorResponse,
  auditService,
  invalidateProfileCache,
} from '@cusown/shared/server';

const ROUTE = 'POST /api/user/update-role';

/**
 * POST /api/user/update-role
 * Set user roles (owner/customer or both). Writes user_roles; syncs user_type for RLS. Audit logged.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request, ROUTE);
    if (auth instanceof Response) return auth;

    const clientIP = getClientIp(request);

    const body = await request.json();
    const { role } = body;

    if (!role || (role !== 'owner' && role !== 'customer')) {
      console.warn(
        `[SECURITY] Invalid role update request from IP: ${clientIP}, User: ${auth.user.id.substring(0, 8)}...`
      );
      return errorResponse('Invalid role. Must be "owner" or "customer"', 400);
    }

    const profile = await userService.getUserProfile(auth.user.id);
    const currentType = profile?.user_type || 'customer';

    if (currentType === 'admin') {
      console.warn(
        `[SECURITY] Attempted role change from admin by IP: ${clientIP}, User: ${auth.user.id.substring(0, 8)}...`
      );
      return errorResponse('Admin role cannot be changed', 403);
    }

    if (role === 'admin') {
      console.warn(
        `[SECURITY] Attempted admin role escalation from IP: ${clientIP}, User: ${auth.user.id.substring(0, 8)}...`
      );
      return errorResponse('Cannot set role to admin', 403);
    }

    let newType: 'owner' | 'customer' | 'both';
    if (currentType === 'both') {
      newType = 'both';
    } else if (currentType === 'owner' && role === 'customer') {
      newType = 'both';
    } else if (currentType === 'customer' && role === 'owner') {
      newType = 'both';
    } else {
      newType = role;
    }

    await userService.updateUserType(auth.user.id, newType);
    invalidateProfileCache(auth.user.id);

    try {
      await auditService.createAuditLog(auth.user.id, 'role_changed', 'user', {
        entityId: auth.user.id,
        oldData: { user_type: currentType },
        newData: { user_type: newType },
        actorRole: currentType,
        request,
      });
    } catch (auditErr) {
      console.error('[SECURITY] Failed to create audit log for role change:', auditErr);
    }

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
