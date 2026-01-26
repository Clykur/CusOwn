import { env } from '@/config/env';
import { generateQRCodeDataUrl } from './qrcode';

export interface UPIPaymentParams {
  amountCents: number;
  paymentId: string;
  bookingId: string;
  customerName: string;
  transactionId: string;
}

export function generateUPIPaymentLink(params: UPIPaymentParams): string {
  const { amountCents, paymentId, bookingId, customerName, transactionId } = params;
  
  const amountRupees = (amountCents / 100).toFixed(2);
  const merchantVpa = env.payment.upiMerchantVpa;
  const merchantName = env.payment.upiMerchantName;
  
  if (!merchantVpa) {
    throw new Error('UPI merchant VPA not configured');
  }

  const transactionNote = encodeURIComponent(`Booking ${bookingId.substring(0, 8)} - ${customerName}`);
  
  const upiLink = `upi://pay?pa=${merchantVpa}&pn=${encodeURIComponent(merchantName)}&am=${amountRupees}&cu=INR&tn=${transactionNote}&tr=${transactionId}`;
  
  return upiLink;
}

export async function generateUPIQRCode(upiLink: string): Promise<string> {
  return generateQRCodeDataUrl(upiLink);
}

export function generateTransactionId(paymentId: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `TXN${timestamp}${random}${paymentId.substring(0, 8).toUpperCase()}`;
}

export function generatePaymentId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10).toUpperCase();
  return `PAY${timestamp}${random}`;
}

import { createHmac, timingSafeEqual } from 'crypto';

export function verifyUPIWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  if (!secret) {
    return false;
  }

  try {
    const hmac = createHmac('sha256', secret);
    hmac.update(payload);
    const expectedSignature = hmac.digest('hex');
    
    return timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

export function parseUPIWebhookPayload(body: any): {
  transactionId: string;
  amountCents: number;
  status: 'success' | 'failed';
  upiAppUsed?: string;
  paymentReference?: string;
} | null {
  try {
    if (typeof body !== 'object' || body === null) {
      return null;
    }

    const transactionId = body.transaction_id || body.transactionId || body.tr;
    const amount = body.amount || body.amount_cents;
    const status = body.status || body.payment_status;
    const upiAppUsed = body.upi_app || body.upiApp || body.app_name;
    const paymentReference = body.payment_reference || body.reference_id || body.ref_id;

    if (!transactionId || !amount || !status) {
      return null;
    }

    const amountCents = typeof amount === 'number' 
      ? Math.round(amount * 100) 
      : parseInt(String(amount), 10);

    const normalizedStatus = status.toLowerCase();
    if (normalizedStatus !== 'success' && normalizedStatus !== 'failed') {
      return null;
    }

    return {
      transactionId: String(transactionId),
      amountCents,
      status: normalizedStatus as 'success' | 'failed',
      upiAppUsed: upiAppUsed ? String(upiAppUsed) : undefined,
      paymentReference: paymentReference ? String(paymentReference) : undefined,
    };
  } catch {
    return null;
  }
}
