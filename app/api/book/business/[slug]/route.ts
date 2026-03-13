import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { ERROR_MESSAGES, CACHE_TTL_API_LONG_MS } from '@/config/constants';
import { setCacheHeaders } from '@/lib/cache/next-cache';
import {
  buildApiCacheKey,
  getCachedApiResponse,
  setCachedApiResponse,
} from '@/lib/cache/api-response-cache';
import { dedupe } from '@/lib/cache/request-dedup';
import { enhancedRateLimit } from '@/lib/security/rate-limit-api.security';
import { requireSupabaseAdmin } from '@/lib/supabase/server';
import {
  buildApiRedisKeyFromPath,
  getApiRedisCache,
  setApiRedisCache,
  API_REDIS_TTL,
} from '@/lib/cache/api-redis-cache';
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
 * Cached 5 min; concurrent identical requests deduped.
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

    // Check Redis cache first
    const redisKey = buildApiRedisKeyFromPath(`/api/book/business/${slug}`);
    const redisCached = await getApiRedisCache<PublicBusiness>(redisKey);
    if (redisCached) {
      const response = successResponse(redisCached);
      setCacheHeaders(response, 300, 600);
      return response;
    }

    // Check in-memory cache
    const cacheKey = buildApiCacheKey('GET', `/api/book/business/${slug}`);
    const cached = getCachedApiResponse<{ data: PublicBusiness }>(cacheKey);
    if (cached) {
      // Populate Redis cache from in-memory cache
      await setApiRedisCache(redisKey, cached.data, API_REDIS_TTL.BUSINESS_PROFILE);
      const response = successResponse(cached.data);
      setCacheHeaders(response, 300, 600);
      return response;
    }

    const supabase = requireSupabaseAdmin();
    if (!supabase) {
      return errorResponse('Service unavailable', 503);
    }

    const data = await dedupe(`business:slug:${slug}`, async () => {
      const { data: row, error } = await supabase
        .from('businesses')
        .select(
          'id, salon_name, opening_time, closing_time, slot_duration, booking_link, address, location'
        )
        .eq('booking_link', slug)
        .eq('suspended', false)
        .single();
      if (error || !row) return null;
      return {
        id: row.id,
        salon_name: row.salon_name,
        opening_time: row.opening_time,
        closing_time: row.closing_time,
        slot_duration: row.slot_duration,
        booking_link: row.booking_link,
        address: row.address ?? null,
        location: row.location ?? null,
      } as PublicBusiness;
    });

    if (!data) {
      return errorResponse(ERROR_MESSAGES.SALON_NOT_FOUND, 404);
    }

    // Cache in both Redis and in-memory
    await setApiRedisCache(redisKey, data, API_REDIS_TTL.BUSINESS_PROFILE);
    setCachedApiResponse(cacheKey, { data }, CACHE_TTL_API_LONG_MS);
    const response = successResponse(data);
    setCacheHeaders(response, 300, 600);
    return response;
  } catch (e) {
    const message = e instanceof Error ? e.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}
