import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { isValidUUID } from '@/lib/utils/security';
import { getServerUser } from '@/lib/supabase/server-auth';
import { paymentService } from '@/services/payment.service';
import { bookingService } from '@/services/booking.service';
import { slotService } from '@/services/slot.service';
import { enhancedRateLimit } from '@/lib/security/rate-limit-enhanced';
import { requireSupabaseAdmin } from '@/lib/supabase/server';
import { ERROR_MESSAGES, BOOKING_STATUS, SLOT_STATUS } from '@/config/constants';

const verifyRateLimit = enhancedRateLimit({
  maxRequests: 20,
  windowMs: 60000,
  perIP: true,
  keyPrefix: 'payment_verify',
});

export async function POST(request: NextRequest) {
  const clientIP = request.ip || request.headers.get('x-forwarded-for') || 'unknown';

  try {
    const rateLimitResponse = await verifyRateLimit(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const user = await getServerUser(request);
    if (!user) {
      return errorResponse('Authentication required', 401);
    }

    const body = await request.json();
    const { payment_id, transaction_id } = body;

    if (!payment_id || typeof payment_id !== 'string') {
      return errorResponse('Payment ID required', 400);
    }

    if (!transaction_id || typeof transaction_id !== 'string') {
      return errorResponse('Transaction ID required', 400);
    }

    const payment = await paymentService.getPaymentByPaymentId(payment_id);
    if (!payment) {
      return errorResponse('Payment not found', 404);
    }

    const { userService } = await import('@/services/user.service');
    const profile = await userService.getUserProfile(user.id);
    const isAdmin = profile?.user_type === 'admin';
    const isOwner = profile?.user_type === 'owner' || profile?.user_type === 'both';

    if (!isAdmin && !isOwner) {
      const booking = await bookingService.getBookingByUuidWithDetails(payment.booking_id);
      if (!booking || booking.customer_user_id !== user.id) {
        return errorResponse('Unauthorized', 403);
      }
    }

    if (payment.status === 'completed') {
      return successResponse({ payment, message: 'Payment already verified' });
    }

    if (payment.status !== 'initiated') {
      return errorResponse(`Payment is in ${payment.status} state`, 400);
    }

    const verifiedPayment = await paymentService.verifyUPIPayment(
      payment.id,
      transaction_id,
      user.id,
      isAdmin || isOwner ? 'manual' : 'manual',
      {}
    );

    const booking = await bookingService.getBookingByUuidWithDetails(payment.booking_id);
    if (!booking) {
      return errorResponse(ERROR_MESSAGES.BOOKING_NOT_FOUND, 404);
    }

    if (booking.status === BOOKING_STATUS.PENDING) {
      try {
        const supabaseAdmin = requireSupabaseAdmin();
        const { data: result, error: funcError } = await supabaseAdmin.rpc(
          'confirm_booking_with_payment',
          {
            p_payment_id: payment.id,
            p_booking_id: booking.id,
            p_slot_id: booking.slot_id,
            p_actor_id: user.id,
          }
        );

        if (funcError) {
          throw new Error(funcError.message);
        }

        if (!result || !result.success) {
          const errorMsg = result?.error || 'Booking confirmation failed';
          await paymentService.markPaymentFailed(
            payment.id,
            errorMsg,
            user.id
          );
          return errorResponse(errorMsg, 409);
        }

        const bookingWithDetails = await bookingService.getBookingByUuidWithDetails(booking.id);
        if (bookingWithDetails) {
          const { emitBookingConfirmed } = await import('@/lib/events/booking-events');
          const { metricsService } = await import('@/lib/monitoring/metrics');
          await emitBookingConfirmed(bookingWithDetails);
          await metricsService.increment('bookings.confirmed');
        }
      } catch (confirmError) {
        await paymentService.markPaymentFailed(
          payment.id,
          'Booking confirmation failed',
          user.id
        );
        throw confirmError;
      }
    }

    return successResponse({
      payment: verifiedPayment,
      booking_id: booking.id,
      message: 'Payment verified and booking confirmed',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Payment verification failed';
    console.error('[PAYMENT_VERIFY] Error:', error);
    return errorResponse(message, 500);
  }
}
