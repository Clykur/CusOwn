import { NextRequest } from 'next/server';
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

    const body = await request.json();
    const { role } = body;

    if (!role || (role !== 'owner' && role !== 'customer')) {
      return errorResponse('Invalid role. Must be "owner" or "customer"', 400);
    }

    // Get current profile
    const profile = await userService.getUserProfile(user.id);
    const currentType = profile?.user_type || 'customer';
    
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

    return successResponse({ user_type: newType });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update role';
    return errorResponse(message, 500);
  }
}

