import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { getServerUser } from '@/lib/supabase/server-auth';
import { paymentService } from '@/services/payment.service';
import { bookingService } from '@/services/booking.service';
import { enhancedRateLimit } from '@/lib/security/rate-limit-api.security';
import { getValidString } from '@/lib/security/input-sanitizer';
import { requireSupabaseAdmin } from '@/lib/supabase/server';
import { ERROR_MESSAGES, BOOKING_STATUS } from '@/config/constants';
import { env } from '@/config/env';

const verifyRateLimit = enhancedRateLimit({
  maxRequests: 20,
  windowMs: 60000,
  keyPrefix: 'payment_verify',
});

function verifyPaymentSignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const secret = env.payment.upiWebhookSecret;

  if (!secret) {
    throw new Error('UPI webhook secret not configured');
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${params.orderId}|${params.paymentId}`)
    .digest('hex');

  // Use timingSafeEqual to prevent timing attacks
  const expectedBuffer = Buffer.from(expected, 'hex');
  const signatureBuffer = Buffer.from(params.signature, 'hex');

  if (expectedBuffer.length !== signatureBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await verifyRateLimit(request);
    if (rateLimitResponse) return rateLimitResponse;

    const user = await getServerUser(request);
    if (!user) {
      return errorResponse('Authentication required', 401);
    }

    const body = await request.json();

    // --- FIX: Validate all required fields BEFORE any security-sensitive branching.
    // CodeQL flagged that user-controlled values were used to gate sensitive actions
    // without upfront validation. We now reject early if any required field is missing,
    // so the values are guaranteed non-null strings when they reach security checks.
    const validatedPaymentId = getValidString(body.payment_id);
    const validatedTransactionId = getValidString(body.transaction_id);
    const validatedSignature = getValidString(body.signature);

    if (!validatedPaymentId) {
      return errorResponse('Payment ID required', 400);
    }

    if (!validatedTransactionId) {
      return errorResponse('Transaction ID required', 400);
    }

    if (!validatedSignature) {
      return errorResponse('Signature required', 400);
    }

    // All three fields are now validated non-empty strings before any DB or
    // security-sensitive logic runs — this resolves the CodeQL
    // "user-controlled bypass of security check" warnings.

    const payment = await paymentService.getPaymentByPaymentId(validatedPaymentId);

    if (!payment) {
      return errorResponse('Payment not found', 404);
    }

    // --- FIX: Perform AUTHORIZATION check before any payment status checks.
    // Previously, the 'completed' early-return branch ran before auth, allowing
    // an attacker to probe payment IDs without being authenticated as the owner.
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

    // --- FIX: ALWAYS verify the signature regardless of payment status.
    // The previous code skipped signature verification for 'completed' payments,
    // which allowed an attacker to replay a known completed payment_id + transaction_id
    // and receive a success response without a valid signature.
    const orderId = payment.payment_id || payment.id;

    const isValid = verifyPaymentSignature({
      orderId,
      paymentId: validatedTransactionId,
      signature: validatedSignature,
    });

    if (!isValid) {
      return errorResponse('Invalid payment signature', 400);
    }

    // Signature is valid — now safe to short-circuit for already-completed payments.
    if (payment.status === 'completed') {
      return successResponse({
        payment,
        message: 'Payment already verified',
      });
    }

    if (payment.status !== 'initiated') {
      return errorResponse(`Payment is in ${payment.status} state`, 400);
    }

    const verifiedPayment = await paymentService.verifyUPIPayment(
      payment.id,
      validatedTransactionId,
      user.id,
      'manual',
      {}
    );

    const booking = await bookingService.getBookingByUuidWithDetails(payment.booking_id);

    if (!booking) {
      return errorResponse(ERROR_MESSAGES.BOOKING_NOT_FOUND, 404);
    }

    if (booking.status === BOOKING_STATUS.PENDING) {
      const supabaseAdmin = requireSupabaseAdmin();

      const { data: result, error: funcError } = await supabaseAdmin.rpc(
        'confirm_booking_with_payment',
        {
          p_booking_id: booking.id,
          p_payment_id: payment.id,
          p_transaction_id: validatedTransactionId,
        }
      );

      if (funcError) {
        console.error('[PAYMENT_VERIFY] RPC error:', funcError);
        await paymentService.markPaymentFailed(payment.id, funcError.message, user.id);
        return errorResponse(funcError.message, 500);
      }

      if (!result || !result.success) {
        const errorMsg = result?.error || 'Booking confirmation failed';
        await paymentService.markPaymentFailed(payment.id, errorMsg, user.id);
        return errorResponse(errorMsg, 409);
      }

      const bookingWithDetails = await bookingService.getBookingByUuidWithDetails(booking.id);

      if (bookingWithDetails) {
        const { emitBookingConfirmed } = await import('@/lib/events/booking-events');
        const { safeMetrics } = await import('@/lib/monitoring/safe-metrics');

        await emitBookingConfirmed(bookingWithDetails);
        safeMetrics.increment('bookings.confirmed');
      }

      return successResponse({
        payment: verifiedPayment,
        booking: bookingWithDetails,
        message: 'Payment verified and booking confirmed',
      });
    }

    return successResponse({
      payment: verifiedPayment,
      message: 'Payment verified successfully',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Payment verification failed';

    console.error('[PAYMENT_VERIFY] Error:', error);

    return errorResponse(message, 500);
  }
}
