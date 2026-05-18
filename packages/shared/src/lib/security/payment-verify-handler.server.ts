import type { NextRequest } from 'next/server';
import crypto from 'crypto';
import { env } from '@cusown/config';
import { ERROR_MESSAGES, BOOKING_STATUS } from '@cusown/config';
import { successResponse, errorResponse } from '../utils/response';
import { getServerUser } from '../supabase/server-auth';
import { paymentService } from '../../services/payment.service';
import { bookingService } from '../../services/booking.service';
import { requireSupabaseAdmin } from '../supabase/server';
import { sanitizeForLog } from '../utils/sanitize-for-log';
import {
  requirePaymentVerifyRequest,
  PaymentVerifyClientError,
  extractValidPaymentSignature,
} from './payment-verify-request.server';

/** Server-only: statuses that may proceed to HMAC verification (fixed allowlist). */
const PAYMENT_STATUSES_REQUIRING_CRYPTO_VERIFY = new Set(['initiated']);

function paymentStatusRequiresCryptographicVerification(status: string): boolean {
  return PAYMENT_STATUSES_REQUIRING_CRYPTO_VERIFY.has(status);
}

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

  const expectedBuffer = Buffer.from(expected, 'hex');
  const signatureBuffer = Buffer.from(params.signature, 'hex');

  if (expectedBuffer.length !== signatureBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
}

function assertValidPaymentSignature(
  signatureField: unknown,
  orderId: string,
  transactionId: string
): void {
  const signature = extractValidPaymentSignature(signatureField);
  const isValid =
    signature !== null &&
    verifyPaymentSignature({
      orderId,
      paymentId: transactionId,
      signature,
    });
  if (!isValid) {
    throw new PaymentVerifyClientError(400, 'Invalid payment signature');
  }
}

/**
 * POST /api/payments/verify — validation, authz, and verification (trust boundary in requirePaymentVerifyRequest).
 */
export async function runPaymentVerifyApi(
  request: NextRequest,
  rateLimitResponse: Response | null
): Promise<Response> {
  try {
    if (rateLimitResponse) return rateLimitResponse;

    const user = await getServerUser(request);
    if (!user) {
      return errorResponse('Authentication required', 401);
    }

    const body: unknown = await request.json();
    const { paymentId, transactionId, signatureField } = requirePaymentVerifyRequest(body);

    const payment = await paymentService.getPaymentByPaymentId(paymentId);

    if (!payment) {
      return errorResponse('Payment not found', 404);
    }

    if (payment.transaction_id && payment.transaction_id !== transactionId) {
      return errorResponse('Transaction mismatch', 400);
    }

    const { userService } = await import('../../services/user.service');
    const profile = await userService.getUserProfile(user.id);

    const isAdmin = profile?.user_type === 'admin';
    const isOwner = profile?.user_type === 'owner' || profile?.user_type === 'both';

    const booking = await bookingService.getBookingByUuidWithDetails(payment.booking_id);

    if (!booking) {
      return errorResponse(ERROR_MESSAGES.BOOKING_NOT_FOUND, 404);
    }

    if (!isAdmin && !isOwner && booking.customer_user_id !== user.id) {
      return errorResponse('Unauthorized', 403);
    }

    if (payment.status === 'completed') {
      return successResponse({
        payment,
        message: 'Payment already verified',
      });
    }

    if (!paymentStatusRequiresCryptographicVerification(payment.status)) {
      return errorResponse(`Payment must be initiated, found ${payment.status}`, 400);
    }

    const orderId = payment.payment_id || payment.id;
    assertValidPaymentSignature(signatureField, orderId, transactionId);

    const verifiedPayment = await paymentService.verifyUPIPayment(
      payment.id,
      transactionId,
      user.id,
      'manual',
      {}
    );

    if (booking.status === BOOKING_STATUS.PENDING) {
      const supabaseAdmin = requireSupabaseAdmin();

      const { data: result, error: funcError } = await supabaseAdmin.rpc(
        'confirm_booking_with_payment',
        {
          p_booking_id: booking.id,
          p_payment_id: payment.id,
          p_transaction_id: transactionId,
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
    if (error instanceof PaymentVerifyClientError) {
      return errorResponse(error.message, error.status);
    }

    const message = error instanceof Error ? error.message : 'Payment verification failed';

    console.error(`[PAYMENT_VERIFY] Error: ${sanitizeForLog(error)}`);

    return errorResponse(message, 500);
  }
}
