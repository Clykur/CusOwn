import { NextRequest } from 'next/server';
import { getClientIp } from '@/lib/utils/security';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { paymentService } from '@/services/payment.service';
import { verifyUPIWebhookSignature, parseUPIWebhookPayload } from '@/lib/utils/upi-payment';
import { createHash } from 'crypto';
import { env } from '@/config/env';
import { requireSupabaseAdmin } from '@/lib/supabase/server';

/** Phase 2: Payment handlers do not modify booking/slot lifecycle. Observational linkage only. */

export async function POST(request: NextRequest) {
  const clientIP = getClientIp(request);

  try {
    const signature =
      request.headers.get('x-upi-signature') || request.headers.get('x-webhook-signature');
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

    const payloadHash = createHash('sha256').update(body).digest('hex');
    const supabaseAdmin = requireSupabaseAdmin();

    const { transactionId, amountCents, status, upiAppUsed, paymentReference } = webhookData;

    const payment = await paymentService.getPaymentByTransactionId(transactionId);
    if (!payment) {
      console.warn(`[WEBHOOK] Payment not found for transaction: ${transactionId}`);
      return errorResponse('Payment not found', 404);
    }

    if (payment.webhook_payload_hash === payloadHash) {
      return successResponse({ success: true, message: 'Already processed' });
    }

    if (payment.status === 'completed') {
      return successResponse({ success: true, payment_id: payment.payment_id });
    }

    if (status === 'failed') {
      await paymentService.markPaymentFailed(payment.id, 'Payment failed via webhook', undefined);
      return successResponse({
        success: true,
        message: 'Payment marked as failed',
      });
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

      await paymentService.verifyUPIPayment(payment.id, transactionId, 'system', 'webhook', {
        upiAppUsed,
        paymentReference,
      });

      await supabaseAdmin
        .from('payments')
        .update({
          webhook_payload_hash: payloadHash,
          updated_at: new Date().toISOString(),
        })
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
