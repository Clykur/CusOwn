/**
 * POST /api/book/set-pending
 * Store pending booking in signed cookie so after login we can complete it on /book/complete.
 * No auth required. Rate limited.
 */

import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { validateCreateBooking } from '@/lib/utils/validation';
import { filterFields, validateStringLength } from '@/lib/security/input-filter';
import { isValidUUID } from '@/lib/utils/security';
import { enhancedRateLimit } from '@/lib/security/rate-limit-api.security';
import {
  ERROR_MESSAGES,
  PENDING_BOOKING_COOKIE,
  PENDING_BOOKING_TTL_SECONDS,
} from '@/config/constants';
import { signPendingBookingPayload } from '@/lib/auth/pending-booking-cookie';

const setPendingRateLimit = enhancedRateLimit({
  maxRequests: 30,
  windowMs: 60000,
  perIP: true,
  keyPrefix: 'book_set_pending',
});

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await setPendingRateLimit(request);
    if (rateLimitResponse) return rateLimitResponse;

    const body = await request.json();
    const allowedFields = ['salon_id', 'slot_id', 'customer_name', 'customer_phone'];
    const filteredBody = filterFields(body, allowedFields as (keyof typeof body)[]);
    const validatedData = validateCreateBooking(filteredBody);

    if (!isValidUUID(validatedData.salon_id) || !isValidUUID(validatedData.slot_id)) {
      return errorResponse('Invalid salon or slot ID', 400);
    }
    if (!validateStringLength(validatedData.customer_name, 200)) {
      return errorResponse('Customer name is too long', 400);
    }
    if (!validateStringLength(validatedData.customer_phone, 20)) {
      return errorResponse('Customer phone is too long', 400);
    }

    const signed = signPendingBookingPayload({
      salon_id: validatedData.salon_id,
      slot_id: validatedData.slot_id,
      customer_name: validatedData.customer_name,
      customer_phone: validatedData.customer_phone,
    });

    const cookieStore = await cookies();
    cookieStore.set(PENDING_BOOKING_COOKIE, signed, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: PENDING_BOOKING_TTL_SECONDS,
      path: '/',
    });

    return successResponse({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 400);
  }
}
