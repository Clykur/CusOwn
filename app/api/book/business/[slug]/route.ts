import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { ERROR_MESSAGES } from '@/config/constants';
import { setCacheHeaders } from '@/lib/cache/next-cache';
import { enhancedRateLimit } from '@/lib/security/rate-limit-api.security';
import { requireSupabaseAdmin } from '@/lib/supabase/server';
import type { PublicBusiness } from '@/types';

const publicBusinessRateLimit = enhancedRateLimit({
  maxRequests: 60,
  windowMs: 60000,
  perIP: true,
  keyPrefix: 'book_business',
});

const SLUG_REGEX = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;

/**
 * GET /api/book/business/[slug]
 * Public: fetch business by booking_link (slug) for QR booking. No auth. No owner data.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const rateLimitResponse = await publicBusinessRateLimit(request);
    if (rateLimitResponse) return rateLimitResponse;

    const { slug } = await params;

    if (!slug || typeof slug !== 'string') {
      return errorResponse(ERROR_MESSAGES.SALON_NOT_FOUND, 404);
    }

    if (!SLUG_REGEX.test(slug)) {
      return errorResponse(ERROR_MESSAGES.SALON_NOT_FOUND, 404);
    }

    const supabase = requireSupabaseAdmin();
    if (!supabase) {
      return errorResponse('Service unavailable', 503);
    }

    const { data, error } = await supabase
      .from('businesses')
      .select(
        'id, salon_name, opening_time, closing_time, slot_duration, booking_link, address, location'
      )
      .eq('booking_link', slug)
      .eq('suspended', false)
      .single();

    if (error || !data) {
      return errorResponse(ERROR_MESSAGES.SALON_NOT_FOUND, 404);
    }

    const publicBusiness: PublicBusiness = {
      id: data.id,
      salon_name: data.salon_name,
      opening_time: data.opening_time,
      closing_time: data.closing_time,
      slot_duration: data.slot_duration,
      booking_link: data.booking_link,
      address: data.address ?? null,
      location: data.location ?? null,
    };

    const response = successResponse(publicBusiness);
    setCacheHeaders(response, 300, 600);
    return response;
  } catch (e) {
    const message = e instanceof Error ? e.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}
