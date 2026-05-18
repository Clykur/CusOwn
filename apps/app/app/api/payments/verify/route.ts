import { NextRequest } from 'next/server';
import { enhancedRateLimit, runPaymentVerifyApi } from '@cusown/shared/server';

const verifyRateLimit = enhancedRateLimit({
  maxRequests: 20,
  windowMs: 60000,
  keyPrefix: 'payment_verify',
});

/** POST /api/payments/verify — delegates to shared handler (validation trust boundary). */
export async function POST(request: NextRequest) {
  const rateLimitResponse = await verifyRateLimit(request);
  return runPaymentVerifyApi(request, rateLimitResponse);
}
