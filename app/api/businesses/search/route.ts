import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { getClientIp, isValidUUID } from '@/lib/utils/security';
import { supabaseAdmin } from '@/lib/supabase/server';
import { enhancedRateLimit } from '@/lib/security/rate-limit-api.security';
import { checkNonce, storeNonce } from '@/lib/security/nonce-store';
import { getServerUser } from '@/lib/supabase/server-auth';
import { haversineDistance, validateCoordinates, validateRadius } from '@/lib/utils/geo';
import { applyActiveBusinessFilters } from '@/lib/db/business-query-filters';

const searchRateLimit = enhancedRateLimit({
  maxRequests: 20,
  windowMs: 60000,
  perIP: true,
  perUser: true,
  keyPrefix: 'geo_search',
});

export async function POST(request: NextRequest) {
  const clientIP = getClientIp(request);

  try {
    const rateLimitResponse = await searchRateLimit(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const requestId = request.headers.get('x-request-id');
    if (requestId) {
      if (!isValidUUID(requestId)) {
        return errorResponse('Invalid request ID', 400);
      }

      const user = await getServerUser(request);
      const nonceExists = await checkNonce(requestId);
      if (nonceExists) {
        return errorResponse('Duplicate request', 409);
      }

      await storeNonce(requestId, user?.id, clientIP);
    }

    const body = await request.json();
    const { filterFields } = await import('@/lib/security/input-filter');

    const allowedFields = [
      'latitude',
      'longitude',
      'city',
      'area',
      'pincode',
      'category',
      'radius_km',
      'available_today',
      'min_rating',
      'page',
      'limit',
      'sort_by',
      'sort_order',
    ] as const;

    const filteredBody = filterFields(body, allowedFields);

    // Validate coordinates
    if (filteredBody.latitude !== undefined || filteredBody.longitude !== undefined) {
      if (
        filteredBody.latitude === undefined ||
        filteredBody.longitude === undefined ||
        !validateCoordinates(filteredBody.latitude, filteredBody.longitude)
      ) {
        return errorResponse('Invalid coordinates', 400);
      }
    }

    // Require at least one location filter
    if (
      !filteredBody.latitude &&
      !filteredBody.city &&
      !filteredBody.area &&
      !filteredBody.pincode
    ) {
      return errorResponse('Location required', 400);
    }

    // Validate radius
    if (filteredBody.radius_km && !validateRadius(filteredBody.radius_km)) {
      return errorResponse('Invalid radius', 400);
    }

    const page = Math.max(1, Math.min(100, filteredBody.page || 1));
    const limit = Math.max(1, Math.min(50, filteredBody.limit || 20));
    const offset = (page - 1) * limit;

    if (!supabaseAdmin) {
      return errorResponse('Service unavailable', 503);
    }

    let query = supabaseAdmin
      .from('businesses')
      .select('id, salon_name, location, category, latitude, longitude, area');

    // Only active & non-deleted businesses
    query = applyActiveBusinessFilters(query);

    // Category filter
    if (filteredBody.category) {
      query = query.eq('category', filteredBody.category);
    }

    // Location filters
    if (filteredBody.pincode) {
      query = query.eq('pincode', filteredBody.pincode);
    } else if (filteredBody.city) {
      query = query.eq('city', filteredBody.city);
      if (filteredBody.area) {
        query = query.eq('area', filteredBody.area);
      }
    }

    const { data: businesses, error } = await query.range(offset, offset + limit);

    if (error) {
      console.error('[GEO_SEARCH] Database error:', error);
      return errorResponse('Search failed', 500);
    }

    if (!businesses) {
      return successResponse({
        businesses: [],
        pagination: { page, limit, total: 0, has_more: false },
      });
    }

    type BusinessResult = {
      id: any;
      salon_name: any;
      location: any;
      category: any;
      latitude: any;
      longitude: any;
      area?: any;
      distance_km?: number;
    };

    let results: BusinessResult[] = businesses as BusinessResult[];
    const hasMore = results.length > limit;

    if (hasMore) {
      results = results.slice(0, limit);
    }

    // Distance filtering
    if (filteredBody.latitude && filteredBody.longitude) {
      const radius = filteredBody.radius_km || 10;

      results = results
        .map((business): BusinessResult | null => {
          if (!business.latitude || !business.longitude) return null;

          const distance = haversineDistance(
            filteredBody.latitude!,
            filteredBody.longitude!,
            business.latitude,
            business.longitude
          );

          if (distance > radius) return null;

          return {
            ...business,
            distance_km: Math.round(distance * 10) / 10,
          };
        })
        .filter((b): b is BusinessResult => b !== null);

      if (filteredBody.sort_by === 'distance') {
        results.sort((a, b) => (a.distance_km ?? 0) - (b.distance_km ?? 0));
      }
    }

    const sanitized = results.map((business) => ({
      id: business.id,
      salon_name: business.salon_name,
      location: business.location || business.area || '',
      distance_km: business.distance_km,
      category: business.category || 'salon',
    }));

    return successResponse({
      businesses: sanitized,
      pagination: {
        page,
        limit,
        total: hasMore ? page * limit + 1 : sanitized.length,
        has_more: hasMore,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Search failed';
    return errorResponse(message, 500);
  }
}
