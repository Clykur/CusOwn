import { NextRequest } from 'next/server';
import { getClientIp } from '@/lib/utils/security';
import { getServerUser } from '@/lib/supabase/server-auth';
import { userService } from '@/services/user.service';
import { successResponse, errorResponse } from '@/lib/utils/response';

/**
 * POST /api/user/update-role
 * Update user's role (owner/customer/both)
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

    // Get current profile
    const profile = await userService.getUserProfile(user.id);
    const currentType = profile?.user_type || 'customer';

    // SECURITY: Prevent admin role escalation
    if (currentType === 'admin') {
      console.warn(
        `[SECURITY] Attempted role change from admin by IP: ${clientIP}, User: ${user.id.substring(0, 8)}...`
      );
      return errorResponse('Admin role cannot be changed', 403);
    }

    // SECURITY: Prevent escalation to admin
    if (role === 'admin') {
      console.warn(
        `[SECURITY] Attempted admin role escalation from IP: ${clientIP}, User: ${user.id.substring(0, 8)}...`
      );
      return errorResponse('Cannot set role to admin', 403);
    }

    // Determine new type
    let newType: 'owner' | 'customer' | 'both' = role;

    if (currentType === 'owner' && role === 'customer') {
      newType = 'both';
    } else if (currentType === 'customer' && role === 'owner') {
      newType = 'both';
    } else if (currentType === 'both') {
      newType = 'both'; // Keep 'both' if already set
    }

    // Update user type
    await userService.updateUserType(user.id, newType);

    const { invalidateProfileCache } = await import('@/lib/cache/auth-cache');
    invalidateProfileCache(user.id);

    console.log(
      `[SECURITY] User role updated: IP: ${clientIP}, User: ${user.id.substring(0, 8)}..., From: ${currentType}, To: ${newType}`
    );

    // Return the new type - redirect logic will be handled by the calling page/API
    // This API does NOT enforce business requirements - that's handled by redirect logic
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
