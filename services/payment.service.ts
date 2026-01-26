import { requireSupabaseAdmin } from '@/lib/supabase/server';
import { ERROR_MESSAGES } from '@/config/constants';
import { env } from '@/config/env';
import { generateUPIPaymentLink, generateUPIQRCode, generateTransactionId, generatePaymentId } from '@/lib/utils/upi-payment';
import { paymentStateMachine } from '@/lib/state/payment-state-machine';

export type PaymentProvider = 'razorpay' | 'stripe' | 'cash' | 'upi';
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'partially_refunded' | 'initiated' | 'expired';

export type Payment = {
  id: string;
  booking_id: string;
  provider: PaymentProvider;
  provider_payment_id: string;
  amount_cents: number;
  currency: string;
  status: PaymentStatus;
  payment_method?: string | null;
  payment_intent_id?: string | null;
  order_id?: string | null;
  idempotency_key?: string | null;
  payment_id?: string | null;
  upi_payment_link?: string | null;
  upi_qr_code?: string | null;
  expires_at?: string | null;
  transaction_id?: string | null;
  verified_at?: string | null;
  verified_by?: string | null;
  verification_method?: 'webhook' | 'manual' | 'polling' | null;
  upi_app_used?: string | null;
  failure_reason?: string | null;
  attempt_count?: number | null;
  created_at: string;
  updated_at: string;
};

export class PaymentService {
  async createPayment(
    bookingId: string,
    provider: PaymentProvider,
    amountCents: number,
    idempotencyKey: string,
    paymentType: 'full' | 'deposit' | 'cash' = 'full'
  ): Promise<Payment> {
    const supabaseAdmin = requireSupabaseAdmin();

    if (idempotencyKey) {
      const { data: existing } = await supabaseAdmin
        .from('payments')
        .select('*')
        .eq('idempotency_key', idempotencyKey)
        .single();

      if (existing) {
        return existing;
      }
    }

    const { data: payment, error } = await supabaseAdmin
      .from('payments')
      .insert({
        booking_id: bookingId,
        provider,
        provider_payment_id: `pending-${Date.now()}`,
        amount_cents: amountCents,
        currency: 'INR',
        status: 'pending',
        idempotency_key: idempotencyKey || null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    if (!payment) {
      throw new Error(ERROR_MESSAGES.DATABASE_ERROR);
    }

    return payment;
  }

  async updatePaymentStatus(
    paymentId: string,
    status: PaymentStatus,
    providerPaymentId?: string,
    webhookData?: { signature?: string; payloadHash?: string }
  ): Promise<Payment> {
    const supabaseAdmin = requireSupabaseAdmin();

    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (providerPaymentId) {
      updateData.provider_payment_id = providerPaymentId;
    }

    if (webhookData) {
      updateData.webhook_received_at = new Date().toISOString();
      if (webhookData.signature) {
        updateData.webhook_signature = webhookData.signature;
      }
      if (webhookData.payloadHash) {
        updateData.webhook_payload_hash = webhookData.payloadHash;
      }
    }

    const { data: payment, error } = await supabaseAdmin
      .from('payments')
      .update(updateData)
      .eq('id', paymentId)
      .select()
      .single();

    if (error) {
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    if (!payment) {
      throw new Error('Payment not found');
    }

    return payment;
  }

  async getPaymentByBooking(bookingId: string): Promise<Payment | null> {
    const supabaseAdmin = requireSupabaseAdmin();

    const { data, error } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    return data;
  }

  async getPaymentByIdempotencyKey(idempotencyKey: string): Promise<Payment | null> {
    const supabaseAdmin = requireSupabaseAdmin();

    const { data, error } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('idempotency_key', idempotencyKey)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    return data;
  }

  calculatePaymentAmount(
    totalPriceCents: number,
    paymentType: 'full' | 'deposit' | 'cash'
  ): number {
    if (paymentType === 'full') {
      return totalPriceCents;
    } else if (paymentType === 'deposit') {
      return Math.ceil(totalPriceCents * 0.3);
    }
    return 0;
  }

  async createUPIPayment(
    bookingId: string,
    amountCents: number,
    customerName: string,
    idempotencyKey: string
  ): Promise<Payment> {
    const supabaseAdmin = requireSupabaseAdmin();

    if (idempotencyKey) {
      const existing = await this.getPaymentByIdempotencyKey(idempotencyKey);
      if (existing) {
        return existing;
      }
    }

    const paymentId = generatePaymentId();
    const transactionId = generateTransactionId(paymentId);
    const upiLink = generateUPIPaymentLink({
      amountCents,
      paymentId,
      bookingId,
      customerName,
      transactionId,
    });
    const qrCode = await generateUPIQRCode(upiLink);

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + env.payment.paymentExpiryMinutes);

    const { data: payment, error } = await supabaseAdmin
      .from('payments')
      .insert({
        booking_id: bookingId,
        provider: 'upi',
        provider_payment_id: paymentId,
        amount_cents: amountCents,
        currency: 'INR',
        status: 'initiated',
        idempotency_key: idempotencyKey || null,
        payment_id: paymentId,
        upi_payment_link: upiLink,
        upi_qr_code: qrCode,
        expires_at: expiresAt.toISOString(),
        transaction_id: transactionId,
        attempt_count: 1,
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    if (!payment) {
      throw new Error(ERROR_MESSAGES.DATABASE_ERROR);
    }

    await this.logPaymentAudit(payment.id, null, 'system', 'payment_initiated', 'initiated', null, {
      payment_id: paymentId,
      transaction_id: transactionId,
    });

    return payment;
  }

  async verifyUPIPayment(
    paymentId: string,
    transactionId: string,
    verifiedBy: string,
    verificationMethod: 'webhook' | 'manual' | 'polling',
    metadata?: { upiAppUsed?: string; paymentReference?: string }
  ): Promise<Payment> {
    const supabaseAdmin = requireSupabaseAdmin();

    const { data: payment, error: fetchError } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (fetchError || !payment) {
      throw new Error('Payment not found');
    }

    if (payment.status === 'completed') {
      return payment;
    }

    if (!paymentStateMachine.canTransition(payment.status, 'verify')) {
      throw new Error(`Cannot verify payment from ${payment.status} state`);
    }

    if (payment.transaction_id !== transactionId) {
      throw new Error('Transaction ID mismatch');
    }

    if (payment.expires_at && new Date(payment.expires_at) < new Date()) {
      if (!env.payment.autoRefundOnLateSuccess) {
        throw new Error('Payment expired');
      }
    }

    const oldStatus = payment.status;
    const nextState = paymentStateMachine.getNextState(payment.status, 'verify');
    if (nextState !== 'completed') {
      throw new Error(`Invalid state transition: ${payment.status} -> ${nextState}`);
    }

    const updateData: any = {
      status: 'completed',
      updated_at: new Date().toISOString(),
      verified_at: new Date().toISOString(),
      verified_by: verifiedBy,
      verification_method: verificationMethod,
    };

    if (metadata?.upiAppUsed) {
      updateData.upi_app_used = metadata.upiAppUsed;
    }

    const { data: updatedPayment, error } = await supabaseAdmin
      .from('payments')
      .update(updateData)
      .eq('id', paymentId)
      .select()
      .single();

    if (error) {
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    if (!updatedPayment) {
      throw new Error('Payment update failed');
    }

    await this.logPaymentAudit(
      paymentId,
      verifiedBy,
      verificationMethod === 'manual' ? 'admin' : 'system',
      'payment_verified',
      oldStatus,
      'completed',
      metadata
    );

    return updatedPayment;
  }

  async markPaymentFailed(
    paymentId: string,
    reason: string,
    actorId?: string
  ): Promise<Payment> {
    const supabaseAdmin = requireSupabaseAdmin();

    const { data: payment } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (!payment) {
      throw new Error('Payment not found');
    }

    if (payment.status === 'completed') {
      throw new Error('Cannot fail completed payment');
    }

    if (!paymentStateMachine.canTransition(payment.status, 'fail')) {
      throw new Error(`Cannot fail payment from ${payment.status} state`);
    }

    const oldStatus = payment.status;
    const nextState = paymentStateMachine.getNextState(payment.status, 'fail');
    if (nextState !== 'failed') {
      throw new Error(`Invalid state transition: ${payment.status} -> ${nextState}`);
    }

    const newAttemptCount = (payment.attempt_count || 0) + 1;

    const { data: updatedPayment, error } = await supabaseAdmin
      .from('payments')
      .update({
        status: 'failed',
        failure_reason: reason,
        attempt_count: newAttemptCount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', paymentId)
      .select()
      .single();

    if (error) {
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    if (!updatedPayment) {
      throw new Error('Payment update failed');
    }

    await supabaseAdmin.from('payment_attempts').insert({
      payment_id: paymentId,
      attempt_number: newAttemptCount,
      status: 'failed',
      error_message: reason,
      created_at: new Date().toISOString(),
    });

    await this.logPaymentAudit(
      paymentId,
      actorId || null,
      actorId ? 'admin' : 'system',
      'payment_failed',
      oldStatus,
      'failed',
      { reason, attempt_count: newAttemptCount }
    );

    return updatedPayment;
  }

  async expirePayments(): Promise<number> {
    const supabaseAdmin = requireSupabaseAdmin();
    const now = new Date().toISOString();

    const { data: expiredPayments, error: fetchError } = await supabaseAdmin
      .from('payments')
      .select('id, status')
      .eq('status', 'initiated')
      .lt('expires_at', now);

    if (fetchError || !expiredPayments || expiredPayments.length === 0) {
      return 0;
    }

    let expiredCount = 0;
    for (const payment of expiredPayments) {
      try {
        if (paymentStateMachine.canTransition(payment.status, 'expire')) {
          const { error: updateError } = await supabaseAdmin
            .from('payments')
            .update({
              status: 'expired',
              failure_reason: 'Payment expired',
              updated_at: new Date().toISOString(),
            })
            .eq('id', payment.id)
            .eq('status', 'initiated');

          if (!updateError) {
            await this.logPaymentAudit(
              payment.id,
              null,
              'system',
              'payment_expired',
              payment.status,
              'expired',
              { reason: 'Payment expired' }
            );
            expiredCount++;
          }
        }
      } catch (error) {
        console.error(`[PAYMENT] Failed to expire payment ${payment.id}:`, error);
      }
    }

    return expiredCount;
  }

  async getPaymentByPaymentId(paymentId: string): Promise<Payment | null> {
    const supabaseAdmin = requireSupabaseAdmin();

    const { data, error } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('payment_id', paymentId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    return data;
  }

  async getPaymentByTransactionId(transactionId: string): Promise<Payment | null> {
    const supabaseAdmin = requireSupabaseAdmin();

    const { data, error } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('transaction_id', transactionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    return data;
  }

  private async logPaymentAudit(
    paymentId: string,
    actorId: string | null,
    actorType: 'customer' | 'owner' | 'admin' | 'system',
    action: string,
    fromStatus: PaymentStatus | null,
    toStatus: PaymentStatus | null,
    metadata?: any
  ): Promise<void> {
    const supabaseAdmin = requireSupabaseAdmin();

    await supabaseAdmin.from('payment_audit_logs').insert({
      payment_id: paymentId,
      actor_id: actorId,
      actor_type: actorType,
      action,
      from_status: fromStatus,
      to_status: toStatus,
      metadata: metadata || {},
    });
  }
}

export const paymentService = new PaymentService();
