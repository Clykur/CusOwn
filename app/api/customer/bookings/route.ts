import { NextRequest, NextResponse } from 'next/server';
import { bookingService } from '@/services/booking.service';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { ERROR_MESSAGES } from '@/config/constants';
import { getServerUser } from '@/lib/supabase/server-auth';
import { setCacheHeaders } from '@/lib/cache/next-cache';
import { hasCustomerAccess } from '@/lib/utils/role-verification';

/**
 * GET /api/customer/bookings
 * Get all bookings for the authenticated customer
 * Requires customer, both, or admin role
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const clientIP = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
  
  console.log('[API_CUSTOMER_BOOKINGS] Request received from IP:', clientIP);
  
  try {
    const user = await getServerUser(request);
    if (!user) {
      console.warn('[API_CUSTOMER_BOOKINGS] No user found in request');
      return errorResponse('Unauthorized', 401);
    }

    console.log('[API_CUSTOMER_BOOKINGS] User authenticated:', user.id.substring(0, 8) + '...', 'email:', user.email);

    // Verify user has customer access
    console.log('[API_CUSTOMER_BOOKINGS] Checking customer access...');
    const hasAccess = await hasCustomerAccess(user.id);
    if (!hasAccess) {
      console.warn(`[API_CUSTOMER_BOOKINGS] Unauthorized customer access attempt from IP: ${clientIP}, User: ${user.id.substring(0, 8)}...`);
      return errorResponse('Customer access required', 403);
    }

    console.log('[API_CUSTOMER_BOOKINGS] Customer access verified, fetching bookings...');
    const bookings = await bookingService.getCustomerBookings(user.id);
    
    const duration = Date.now() - startTime;
    console.log(`[API_CUSTOMER_BOOKINGS] Successfully fetched ${bookings.length} bookings in ${duration}ms`);
    
    const response = successResponse(bookings);
    setCacheHeaders(response, 30, 60);
    return response;
  } catch (error) {
    const duration = Date.now() - startTime;
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    console.error(`[API_CUSTOMER_BOOKINGS] Error after ${duration}ms:`, {
      message,
      error: error instanceof Error ? error.stack : String(error),
    });
    return errorResponse(message, 500);
  }
}
