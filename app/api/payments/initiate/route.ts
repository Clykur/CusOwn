import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { isValidUUID } from '@/lib/utils/security';
import { getServerUser } from '@/lib/supabase/server-auth';
import { bookingService } from '@/services/booking.service';
import { slotService } from '@/services/slot.service';
import { paymentService } from '@/services/payment.service';
import { enhancedRateLimit } from '@/lib/security/rate-limit-api.security';
import { checkNonce, storeNonce } from '@/lib/security/nonce-store';
import { env } from '@/config/env';
import { ERROR_MESSAGES, SLOT_STATUS, BOOKING_STATUS } from '@/config/constants';

const initiateRateLimit = enhancedRateLimit({
  maxRequests: 10,
  windowMs: 60000,
  perIP: true,
  keyPrefix: 'payment_initiate',
});

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await initiateRateLimit(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const user = await getServerUser(request);
    if (!user) {
      return errorResponse('Authentication required', 401);
    }

    const body = await request.json();
    const { booking_id, nonce } = body;

    if (!isValidUUID(booking_id)) {
      return errorResponse('Invalid booking ID', 400);
    }

    if (!nonce || typeof nonce !== 'string') {
      return errorResponse('Nonce required', 400);
    }

    if (!(await checkNonce(nonce))) {
      return errorResponse('Invalid or expired nonce', 400);
    }

    const booking = await bookingService.getBookingByUuidWithDetails(booking_id);
    if (!booking) {
      return errorResponse(ERROR_MESSAGES.BOOKING_NOT_FOUND, 404);
    }

    if (booking.customer_user_id && booking.customer_user_id !== user.id) {
      return errorResponse('Unauthorized', 403);
    }

    if (booking.status !== BOOKING_STATUS.PENDING) {
      return errorResponse('Booking is not in pending state', 400);
    }

    const slot = await slotService.getSlotById(booking.slot_id);
    if (!slot) {
      return errorResponse(ERROR_MESSAGES.SLOT_NOT_FOUND, 404);
    }

    if (slot.status === SLOT_STATUS.BOOKED) {
      return errorResponse(ERROR_MESSAGES.SLOT_NOT_AVAILABLE, 409);
    }

    if (slot.status === SLOT_STATUS.RESERVED && slot.reserved_until) {
      const reservedUntil = new Date(slot.reserved_until);
      const now = new Date();
      if (reservedUntil > now) {
        const slotExpiryMinutes = env.payment.slotExpiryMinutes;
        const slotExpiryTime = new Date(booking.created_at);
        slotExpiryTime.setMinutes(slotExpiryTime.getMinutes() + slotExpiryMinutes);

        if (now > slotExpiryTime) {
          return errorResponse('Slot reservation expired', 409);
        }
      } else {
        return errorResponse(ERROR_MESSAGES.SLOT_NOT_AVAILABLE, 409);
      }
    }

    if (!booking.total_price_cents || booking.total_price_cents <= 0) {
      return errorResponse('Invalid booking amount', 400);
    }

    const existingPayment = await paymentService.getPaymentByBooking(booking_id);
    if (existingPayment) {
      if (existingPayment.status === 'completed') {
        return errorResponse('Payment already completed', 400);
      }
      if (existingPayment.status === 'initiated' && existingPayment.expires_at) {
        const expiresAt = new Date(existingPayment.expires_at);
        if (expiresAt > new Date()) {
          return successResponse({
            payment_id: existingPayment.payment_id,
            upi_payment_link: existingPayment.upi_payment_link,
            upi_qr_code: existingPayment.upi_qr_code,
            expires_at: existingPayment.expires_at,
            transaction_id: existingPayment.transaction_id,
          });
        }
      }
    }

    const idempotencyKey = `initiate_${booking_id}_${nonce}`;
    const amountCents = booking.total_price_cents;

    const payment = await paymentService.createUPIPayment(
      booking_id,
      amountCents,
      booking.customer_name,
      idempotencyKey
    );

    const supabaseAdmin = await import('@/lib/supabase/server').then((m) =>
      m.requireSupabaseAdmin()
    );
    await supabaseAdmin
      .from('bookings')
      .update({
        payment_required: true,
        payment_type: 'full',
      })
      .eq('id', booking_id);

    await storeNonce(nonce);

    return successResponse({
      payment_id: payment.payment_id,
      upi_payment_link: payment.upi_payment_link,
      upi_qr_code: payment.upi_qr_code,
      expires_at: payment.expires_at,
      transaction_id: payment.transaction_id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Payment initiation failed';
    console.error('[PAYMENT_INITIATE] Error:', error);
    return errorResponse(message, 500);
  }
}
