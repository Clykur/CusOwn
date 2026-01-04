import { NextRequest } from 'next/server';
import { getServerUser } from '@/lib/supabase/server-auth';
import { userService } from '@/services/user.service';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { ERROR_MESSAGES } from '@/config/constants';

/**
 * GET /api/customer/bookings
 * Get all bookings for the authenticated customer
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getServerUser(request);

    if (!user) {
      return errorResponse('Authentication required', 401);
    }

    // Get user's bookings
    const bookings = await userService.getUserBookings(user.id);

    return successResponse(bookings);
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}

