import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { getClientIp, isValidUUID } from '@/lib/utils/security';
import { supabaseAdmin } from '@/lib/supabase/server';
import { enhancedRateLimit } from '@/lib/security/rate-limit-api.security';
import { checkNonce, storeNonce } from '@/lib/security/nonce-store';
import { getServerUser } from '@/lib/supabase/server-auth';
import { haversineDistance, parseAndValidateCoordinates, validateRadius } from '@/lib/utils/geo';
import { applyActiveBusinessFilters } from '@/lib/db/business-query-filters';
import { ERROR_MESSAGES, ROUTING_ENRICH_MAX_BUSINESSES } from '@/config/constants';

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

    // Validate coordinates (if present)
    if (filteredBody.latitude !== undefined || filteredBody.longitude !== undefined) {
      try {
        parseAndValidateCoordinates(filteredBody.latitude, filteredBody.longitude);
      } catch {
        return errorResponse(ERROR_MESSAGES.GEO_INVALID_COORDINATES, 400);
      }
    }

    // Require at least one location filter
    if (
      !filteredBody.latitude &&
      !filteredBody.city &&
      !filteredBody.area &&
      !filteredBody.pincode
    ) {
      return errorResponse(ERROR_MESSAGES.LOCATION_REQUIRED, 400);
    }

    // Validate radius
    if (filteredBody.radius_km !== undefined && !validateRadius(filteredBody.radius_km)) {
      return errorResponse(ERROR_MESSAGES.INVALID_INPUT, 400);
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
      id: string;
      salon_name: string | null;
      location: string | null;
      category: string | null;
      latitude: number | null;
      longitude: number | null;
      area?: string | null;
      distance_km?: number;
      estimated_time_minutes?: number;
      is_routed?: boolean;
      route_source?: string;
    };

    let results: BusinessResult[] = businesses as BusinessResult[];
    const hasMore = results.length > limit;

    if (hasMore) {
      results = results.slice(0, limit);
    }

    // Distance filtering
    if (filteredBody.latitude !== undefined && filteredBody.longitude !== undefined) {
      const radius = filteredBody.radius_km || 10;
      if (!validateRadius(radius)) return errorResponse(ERROR_MESSAGES.INVALID_INPUT, 400);

      const { lat: userLat, lng: userLng } = parseAndValidateCoordinates(
        filteredBody.latitude,
        filteredBody.longitude
      );

      results = results
        .map((business): BusinessResult | null => {
          const bizLat = Number(business.latitude);
          const bizLng = Number(business.longitude);
          if (!Number.isFinite(bizLat) || !Number.isFinite(bizLng)) return null;

          const distance = haversineDistance(userLat, userLng, bizLat, bizLng);
          if (!Number.isFinite(distance) || distance > radius) return null;

          return {
            ...business,
            // keep raw distance (km). Presentation layer should round.
            distance_km: distance,
          };
        })
        .filter((b): b is BusinessResult => b !== null);

      if (filteredBody.sort_by === 'distance') {
        results.sort((a, b) => (a.distance_km ?? 0) - (b.distance_km ?? 0));
      }

      // Enrich only first N with routed distance/time to limit parallel routing calls
      const toEnrich = results.slice(0, ROUTING_ENRICH_MAX_BUSINESSES);
      const { getRoute } = await import('@/lib/routing');
      const enriched = await Promise.all(
        toEnrich.map(async (biz) => {
          try {
            const route = await getRoute({
              startLat: userLat,
              startLng: userLng,
              endLat: Number(biz.latitude),
              endLng: Number(biz.longitude),
              mode: 'walking',
            });
            return {
              ...biz,
              distance_km: route.distance_km,
              estimated_time_minutes: route.estimated_time_minutes,
              is_routed: route.routed,
              route_source: route.source,
            } as BusinessResult;
          } catch {
            return biz;
          }
        })
      );
      const rest = results.slice(ROUTING_ENRICH_MAX_BUSINESSES);
      results = [...enriched, ...rest];
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
