import { NextRequest } from 'next/server';
import { bookingService } from '@/services/booking.service';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { isValidUUID, validateResourceToken } from '@/lib/utils/security';
import { ERROR_MESSAGES } from '@/config/constants';
import { getServerUser } from '@/lib/supabase/server-auth';
import { userService } from '@/services/user.service';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const clientIP = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
  
  try {
    const { id } = params;

    if (!id || !isValidUUID(id)) {
      console.warn(`[SECURITY] Invalid booking UUID format from IP: ${clientIP}`);
      return errorResponse(ERROR_MESSAGES.BOOKING_NOT_FOUND, 404);
    }

    // Validate token if provided
    const token = request.nextUrl.searchParams.get('token');
    if (token) {
      let decodedToken = token;
      try {
        decodedToken = decodeURIComponent(token);
      } catch {
        // Use original token if decoding fails
      }
      
      if (!validateResourceToken('booking-status', id, decodedToken)) {
        console.warn(`[SECURITY] Invalid booking token from IP: ${clientIP}, Booking: ${id.substring(0, 8)}...`);
        return errorResponse('Invalid or expired access token', 403);
      }
    }

    const booking = await bookingService.getBookingByUuidWithDetails(id);

    if (!booking) {
      console.warn(`[SECURITY] Booking not found from IP: ${clientIP}, Booking: ${id.substring(0, 8)}...`);
      return errorResponse(ERROR_MESSAGES.BOOKING_NOT_FOUND, 404);
    }

    // Authorization: user must be customer, owner, or admin
    const user = await getServerUser(request);
    if (user) {
      // Check if user is the customer
      const isCustomer = booking.customer_user_id === user.id;
      
      // Check if user owns the business
      let isOwner = false;
      if (booking.business_id) {
        const userBusinesses = await userService.getUserBusinesses(user.id);
        isOwner = userBusinesses.some(b => b.id === booking.business_id);
      }
      
      // Check if user is admin
      const profile = await userService.getUserProfile(user.id);
      const isAdmin = profile?.user_type === 'admin';
      
      if (!isCustomer && !isOwner && !isAdmin && !token) {
        console.warn(`[SECURITY] Unauthorized booking access from IP: ${clientIP}, User: ${user.id.substring(0, 8)}..., Booking: ${id.substring(0, 8)}...`);
        return errorResponse('Access denied', 403);
      }
    } else if (!token) {
      // If no user and no token, deny access
      console.warn(`[SECURITY] Unauthenticated booking access attempt from IP: ${clientIP}, Booking: ${id.substring(0, 8)}...`);
      return errorResponse('Authentication required', 401);
    }

    return successResponse(booking);
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    console.error(`[SECURITY] Booking access error: IP: ${clientIP}, Error: ${message}`);
    return errorResponse(message, 500);
  }
}

