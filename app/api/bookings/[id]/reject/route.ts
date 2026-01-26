import { NextRequest, NextResponse } from 'next/server';
import { bookingService } from '@/services/booking.service';
import { whatsappService } from '@/services/whatsapp.service';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { isValidUUID, validateResourceToken } from '@/lib/utils/security';
import { setNoCacheHeaders } from '@/lib/cache/next-cache';
import { SUCCESS_MESSAGES, ERROR_MESSAGES } from '@/config/constants';
import { getServerUser } from '@/lib/supabase/server-auth';
import { userService } from '@/services/user.service';
import { enhancedRateLimit } from '@/lib/security/rate-limit-enhanced';
import { auditService } from '@/services/audit.service';

const rejectRateLimit = enhancedRateLimit({ maxRequests: 10, windowMs: 60000, perIP: true, keyPrefix: 'booking_reject' });

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const clientIP = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
  
  try {
    const rateLimitResponse = await rejectRateLimit(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const { id } = params;
    if (!id || !isValidUUID(id)) {
      console.warn(`[SECURITY] Invalid booking ID format from IP: ${clientIP}`);
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
      
      if (!validateResourceToken('reject', id, decodedToken)) {
        console.warn(`[SECURITY] Invalid reject token from IP: ${clientIP}, Booking: ${id.substring(0, 8)}...`);
        return errorResponse('Invalid or expired access token', 403);
      }
    }

    // Verify ownership: user must own the business for this booking
    const user = await getServerUser(request);
    const booking = await bookingService.getBookingByUuidWithDetails(id);
    
    if (!booking) {
      console.warn(`[SECURITY] Booking not found from IP: ${clientIP}, Booking: ${id.substring(0, 8)}...`);
      return errorResponse(ERROR_MESSAGES.BOOKING_NOT_FOUND, 404);
    }

    // Authorization check: user must own the business
    if (user) {
      const userBusinesses = await userService.getUserBusinesses(user.id);
      const hasAccess = userBusinesses.some(b => b.id === booking.business_id);
      if (!hasAccess) {
        // Check if user is admin
        const profile = await userService.getUserProfile(user.id);
        const isAdmin = profile?.user_type === 'admin';
        if (!isAdmin) {
          console.warn(`[SECURITY] Unauthorized reject attempt from IP: ${clientIP}, User: ${user.id.substring(0, 8)}..., Booking: ${id.substring(0, 8)}...`);
          return errorResponse('Access denied', 403);
        }
      }
    } else if (!token) {
      // If no user and no token, deny access
      console.warn(`[SECURITY] Unauthenticated reject attempt from IP: ${clientIP}, Booking: ${id.substring(0, 8)}...`);
      return errorResponse('Authentication required', 401);
    }

    const rejectedBooking = await bookingService.rejectBooking(id);
    const bookingWithDetails = await bookingService.getBookingByUuidWithDetails(id);
    
    if (!bookingWithDetails || !bookingWithDetails.salon || !bookingWithDetails.slot) {
      throw new Error(ERROR_MESSAGES.BOOKING_NOT_FOUND);
    }

    const whatsappUrl = whatsappService.getRejectionWhatsAppUrl(
      bookingWithDetails,
      bookingWithDetails.salon,
      request
    );

    // SECURITY: Log mutation for audit
    if (user) {
      try {
        await auditService.createAuditLog(
          user.id,
          'booking_rejected',
          'booking',
          {
            entityId: id,
            description: 'Booking rejected by owner',
            request,
          }
        );
      } catch (auditError) {
        console.error('[SECURITY] Failed to create audit log:', auditError);
      }
    }
    
    console.log(`[SECURITY] Booking rejected: IP: ${clientIP}, Booking: ${id.substring(0, 8)}..., User: ${user?.id.substring(0, 8) || 'token-based'}...`);

    const response = successResponse(
      {
        ...rejectedBooking,
        whatsapp_url: whatsappUrl,
      },
      SUCCESS_MESSAGES.BOOKING_REJECTED
    );
    setNoCacheHeaders(response);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 400);
  }
}

