import { NextRequest, NextResponse } from 'next/server';
import { bookingService } from '@/services/booking.service';
import { whatsappService } from '@/services/whatsapp.service';
import { reminderService } from '@/services/reminder.service';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { isValidUUID, validateResourceToken } from '@/lib/utils/security';
import { setNoCacheHeaders } from '@/lib/cache/next-cache';
import { SUCCESS_MESSAGES, ERROR_MESSAGES } from '@/config/constants';
import { getServerUser } from '@/lib/supabase/server-auth';
import { userService } from '@/services/user.service';
import { enhancedRateLimit } from '@/lib/security/rate-limit-enhanced';
import { auditService } from '@/services/audit.service';

const acceptRateLimit = enhancedRateLimit({ maxRequests: 10, windowMs: 60000, perIP: true, keyPrefix: 'booking_accept' });

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const clientIP = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
  
  try {
    const rateLimitResponse = await acceptRateLimit(request);
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
      
      if (!validateResourceToken('accept', id, decodedToken)) {
        console.warn(`[SECURITY] Invalid accept token from IP: ${clientIP}, Booking: ${id.substring(0, 8)}...`);
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
          console.warn(`[SECURITY] Unauthorized accept attempt from IP: ${clientIP}, User: ${user.id.substring(0, 8)}..., Booking: ${id.substring(0, 8)}...`);
          return errorResponse('Access denied', 403);
        }
      }
    } else if (!token) {
      // If no user and no token, deny access
      console.warn(`[SECURITY] Unauthenticated accept attempt from IP: ${clientIP}, Booking: ${id.substring(0, 8)}...`);
      return errorResponse('Authentication required', 401);
    }

    const confirmedBooking = await bookingService.confirmBooking(id, user?.id);
    const bookingWithDetails = await bookingService.getBookingByUuidWithDetails(id);
    
    if (!bookingWithDetails || !bookingWithDetails.salon || !bookingWithDetails.slot) {
      throw new Error(ERROR_MESSAGES.BOOKING_NOT_FOUND);
    }

    // Check if salon has address (required for confirmation message)
    if (!bookingWithDetails.salon.address || bookingWithDetails.salon.address.trim() === '') {
      throw new Error('Salon address is required to send confirmation. Please update the salon address first.');
    }

    const whatsappUrl = whatsappService.getConfirmationWhatsAppUrl(
      bookingWithDetails,
      bookingWithDetails.salon,
      request
    );

    await reminderService.scheduleBookingReminders(id);

    // SECURITY: Log mutation for audit
    if (user) {
      try {
        await auditService.createAuditLog(
          user.id,
          'booking_confirmed',
          'booking',
          {
            entityId: id,
            description: 'Booking confirmed by owner',
            request,
          }
        );
      } catch (auditError) {
        console.error('[SECURITY] Failed to create audit log:', auditError);
      }
    }
    
    console.log(`[SECURITY] Booking accepted: IP: ${clientIP}, Booking: ${id.substring(0, 8)}..., User: ${user?.id.substring(0, 8) || 'token-based'}...`);

    const response = successResponse(
      {
        ...confirmedBooking,
        whatsapp_url: whatsappUrl,
      },
      SUCCESS_MESSAGES.BOOKING_CONFIRMED
    );
    setNoCacheHeaders(response);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    console.error(`[SECURITY] Accept booking error: IP: ${clientIP}, Error: ${message}`);
    return errorResponse(message, 400);
  }
}

