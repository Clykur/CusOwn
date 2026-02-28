import { createHmac, timingSafeEqual } from 'crypto';
import { env } from '@/config/env';

export function verifyRazorpayWebhook(body: string, signature: string, secret: string): boolean {
  try {
    const hmac = createHmac('sha256', secret);
    hmac.update(body);
    const generatedSignature = hmac.digest('hex');
    return timingSafeEqual(Buffer.from(signature), Buffer.from(generatedSignature));
  } catch {
    return false;
  }
}

export function verifyStripeWebhook(
  body: string,
  signature: string,
  secret: string,
  timestamp: string
): boolean {
  try {
    const signedPayload = `${timestamp}.${body}`;
    const hmac = createHmac('sha256', secret);
    hmac.update(signedPayload);
    const expectedSignature = hmac.digest('hex');
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  } catch {
    return false;
  }
}

export function getWebhookSecret(provider: 'razorpay' | 'stripe'): string {
  if (provider === 'razorpay') {
    return env.security.razorpayWebhookSecret || '';
  }
  return env.security.stripeWebhookSecret || '';
}
