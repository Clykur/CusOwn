import { NextRequest, NextResponse } from 'next/server';
import { bookingService } from '@/services/booking.service';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { ERROR_MESSAGES } from '@/config/constants';
import { setCacheHeaders, setNoCacheHeaders } from '@/lib/cache/next-cache';
import { getServerUser } from '@/lib/supabase/server-auth';
import { userService } from '@/services/user.service';

export async function GET(
  request: NextRequest,
  { params }: { params: { bookingId: string } }
) {
  const clientIP = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
  
  try {
    const { bookingId } = params;
    if (!bookingId) {
      console.warn(`[SECURITY] Missing bookingId from IP: ${clientIP}`);
      return errorResponse(ERROR_MESSAGES.BOOKING_NOT_FOUND, 404);
    }

    const booking = await bookingService.getBookingById(bookingId);
    if (!booking) {
      console.warn(`[SECURITY] Booking not found from IP: ${clientIP}, BookingId: ${bookingId.substring(0, 8)}...`);
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
      
      if (!isCustomer && !isOwner && !isAdmin) {
        console.warn(`[SECURITY] Unauthorized booking access from IP: ${clientIP}, User: ${user.id.substring(0, 8)}..., BookingId: ${bookingId.substring(0, 8)}...`);
        return errorResponse('Access denied', 403);
      }
    } else {
      // For public bookingId access, only allow if customer_user_id is null (legacy bookings)
      // This maintains backward compatibility but logs the access
      if (booking.customer_user_id) {
        console.warn(`[SECURITY] Unauthenticated access to authenticated booking from IP: ${clientIP}, BookingId: ${bookingId.substring(0, 8)}...`);
        return errorResponse('Authentication required', 401);
      }
    }

    const response = successResponse(booking);
    if (booking.status === 'pending' || booking.status === 'confirmed') {
      setCacheHeaders(response, 30, 60);
    } else {
      setCacheHeaders(response, 300, 600);
    }
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    console.error(`[SECURITY] Booking access error: IP: ${clientIP}, Error: ${message}`);
    return errorResponse(message, 500);
  }
}
