import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { paymentService } from '@/services/payment.service';
import { bookingService } from '@/services/booking.service';
import { slotService } from '@/services/slot.service';
import { verifyUPIWebhookSignature, parseUPIWebhookPayload } from '@/lib/utils/upi-payment';
import { createHash } from 'crypto';
import { env } from '@/config/env';
import { ERROR_MESSAGES, BOOKING_STATUS, SLOT_STATUS } from '@/config/constants';

export async function POST(request: NextRequest) {
  const clientIP = request.ip || request.headers.get('x-forwarded-for') || 'unknown';

  try {
    const signature = request.headers.get('x-upi-signature') || request.headers.get('x-webhook-signature');
    if (!signature) {
      console.warn(`[WEBHOOK] Missing signature from IP: ${clientIP}`);
      return errorResponse('Missing signature', 401);
    }

    const body = await request.text();
    const secret = env.payment.upiWebhookSecret;

    if (!secret) {
      console.error('[WEBHOOK] UPI webhook secret not configured');
      return errorResponse('Webhook not configured', 500);
    }

    if (!verifyUPIWebhookSignature(body, signature, secret)) {
      console.warn(`[SECURITY] Invalid UPI webhook signature from IP: ${clientIP}`);
      return errorResponse('Invalid signature', 401);
    }

    const payload = JSON.parse(body);
    const webhookData = parseUPIWebhookPayload(payload);

    if (!webhookData) {
      return errorResponse('Invalid webhook payload', 400);
    }

    const { transactionId, amountCents, status, upiAppUsed, paymentReference } = webhookData;

    const payment = await paymentService.getPaymentByTransactionId(transactionId);
    if (!payment) {
      console.warn(`[WEBHOOK] Payment not found for transaction: ${transactionId}`);
      return errorResponse('Payment not found', 404);
    }

    if (payment.status === 'completed') {
      const payloadHash = createHash('sha256').update(body).digest('hex');
      const supabaseAdmin = await import('@/lib/supabase/server').then(m => m.requireSupabaseAdmin());
      
      const { data: existing } = await supabaseAdmin
        .from('payments')
        .select('webhook_payload_hash')
        .eq('id', payment.id)
        .single();

      if (existing?.webhook_payload_hash === payloadHash) {
        return successResponse({ success: true, message: 'Already processed' });
      }
    }

    if (status === 'failed') {
      await paymentService.markPaymentFailed(
        payment.id,
        'Payment failed via webhook',
        undefined
      );

      const booking = await bookingService.getBookingByUuidWithDetails(payment.booking_id);
      if (booking && booking.status === BOOKING_STATUS.PENDING) {
        await slotService.releaseSlot(booking.slot_id);
      }

      return successResponse({ success: true, message: 'Payment marked as failed' });
    }

    if (status === 'success') {
      if (amountCents !== payment.amount_cents) {
        console.error(`[SECURITY] Amount mismatch for payment ${payment.id}`);
        return errorResponse('Amount verification failed', 400);
      }

      if (payment.expires_at && new Date(payment.expires_at) < new Date()) {
        if (!env.payment.autoRefundOnLateSuccess) {
          console.warn(`[WEBHOOK] Payment ${payment.id} expired but webhook received`);
          return errorResponse('Payment expired', 400);
        }
      }

      const verifiedPayment = await paymentService.verifyUPIPayment(
        payment.id,
        transactionId,
        'system',
        'webhook',
        {
          upiAppUsed,
          paymentReference,
        }
      );

      const booking = await bookingService.getBookingByUuidWithDetails(payment.booking_id);
      if (!booking) {
        console.error(`[WEBHOOK] Booking not found for payment ${payment.id}`);
        return errorResponse(ERROR_MESSAGES.BOOKING_NOT_FOUND, 404);
      }

      if (booking.status === BOOKING_STATUS.PENDING) {
        try {
          const supabaseAdmin = await import('@/lib/supabase/server').then(m => m.requireSupabaseAdmin());
          const { data: result, error: funcError } = await supabaseAdmin.rpc(
            'confirm_booking_with_payment',
            {
              p_payment_id: payment.id,
              p_booking_id: booking.id,
              p_slot_id: booking.slot_id,
              p_actor_id: null,
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
              undefined
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
            undefined
          );
          throw confirmError;
        }
      }

      const payloadHash = createHash('sha256').update(body).digest('hex');
      const supabaseAdmin = await import('@/lib/supabase/server').then(m => m.requireSupabaseAdmin());
      await supabaseAdmin
        .from('payments')
        .update({ webhook_payload_hash: payloadHash })
        .eq('id', payment.id);

      return successResponse({ success: true, payment_id: payment.payment_id });
    }

    return errorResponse('Unknown payment status', 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook processing failed';
    console.error('[WEBHOOK] Error:', error);
    return errorResponse(message, 500);
  }
}
