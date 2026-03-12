import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { getClientIp, isValidUUID } from '@/lib/utils/security';
import { supabaseAdmin } from '@/lib/supabase/server';
import { enhancedRateLimit } from '@/lib/security/rate-limit-api.security';
import { checkNonce, storeNonce } from '@/lib/security/nonce-store';
import { getServerUser } from '@/lib/supabase/server-auth';
import { parseAndValidateCoordinates, validateRadius } from '@/lib/utils/geo';
import { ipLookupWithFallback } from '@/lib/geo/geo-service-wrapper';
import { queryDiscoveryFallback } from '@/lib/db/discovery-fallback';
import { logStructured } from '@/lib/observability/structured-log';
import { safeMetrics } from '@/lib/monitoring/safe-metrics';
import { ERROR_MESSAGES, ROUTING_ENRICH_MAX_BUSINESSES } from '@/config/constants';
import {
  DISCOVERY_WEIGHT_DISTANCE,
  DISCOVERY_WEIGHT_RATING,
  DISCOVERY_WEIGHT_AVAILABILITY,
  DISCOVERY_WEIGHT_POPULARITY,
  DISCOVERY_WEIGHT_REPEAT_CUSTOMER,
  DISCOVERY_RATING_SCALE_MAX,
  DISCOVERY_POPULARITY_CAP,
  DISCOVERY_SLOT_WINDOW_DAYS,
  DISCOVERY_DEFAULT_RADIUS_KM,
  DISCOVERY_PAGE_MIN,
  DISCOVERY_PAGE_MAX,
  DISCOVERY_LIMIT_MIN,
  DISCOVERY_LIMIT_MAX,
  DISCOVERY_DEFAULT_LIMIT,
  METRICS_DISCOVERY_FALLBACK_GEO,
  METRICS_DISCOVERY_FALLBACK_RPC,
} from '@/config/constants';

const DISCOVERY_ENDPOINT = 'POST /api/businesses/search';

export type DiscoveryFallbackReason = 'geo_provider' | 'rpc';

export interface DiscoveryFallbackContext {
  usedFallback: boolean;
  reason?: DiscoveryFallbackReason;
}

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
      'explain',
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
    const radiusKm =
      filteredBody.radius_km !== undefined ? filteredBody.radius_km : DISCOVERY_DEFAULT_RADIUS_KM;
    if (!validateRadius(radiusKm)) {
      return errorResponse(ERROR_MESSAGES.INVALID_INPUT, 400);
    }

    // Pagination mandatory: clamp to configured bounds
    const page = Math.max(
      DISCOVERY_PAGE_MIN,
      Math.min(DISCOVERY_PAGE_MAX, filteredBody.page ?? DISCOVERY_PAGE_MIN)
    );
    const limit = Math.max(
      DISCOVERY_LIMIT_MIN,
      Math.min(DISCOVERY_LIMIT_MAX, filteredBody.limit ?? DISCOVERY_DEFAULT_LIMIT)
    );
    const offset = (page - 1) * limit;

    if (!supabaseAdmin) {
      return errorResponse('Service unavailable', 503);
    }

    const fallbackContext: DiscoveryFallbackContext = { usedFallback: false };

    const hasGeoFromBody =
      filteredBody.latitude !== undefined &&
      filteredBody.longitude !== undefined &&
      Number.isFinite(Number(filteredBody.latitude)) &&
      Number.isFinite(Number(filteredBody.longitude));

    let lat: number | null = null;
    let lng: number | null = null;
    if (hasGeoFromBody) {
      try {
        const coords = parseAndValidateCoordinates(filteredBody.latitude, filteredBody.longitude);
        lat = coords.lat;
        lng = coords.lng;
      } catch {
        return errorResponse(ERROR_MESSAGES.GEO_INVALID_COORDINATES, 400);
      }
    } else {
      const geoOutcome = await ipLookupWithFallback(clientIP, {
        requestId: requestId ?? undefined,
        endpoint: DISCOVERY_ENDPOINT,
      });
      if (geoOutcome.ok) {
        lat = geoOutcome.data.latitude;
        lng = geoOutcome.data.longitude;
      } else {
        fallbackContext.usedFallback = true;
        fallbackContext.reason = 'geo_provider';
        logStructured('warn', 'Discovery fallback: geo provider unavailable', {
          service: 'geo_service',
          failure_reason: 'geo_provider',
          timestamp: new Date().toISOString(),
          request_id: requestId ?? undefined,
          endpoint: DISCOVERY_ENDPOINT,
          fallback_used: true,
          fallback_reason: 'geo_provider',
        });
      }
    }

    const hasGeo = lat !== null && lng !== null;

    let ranked: unknown[] | null = null;
    let rpcError: unknown = null;
    const rpcResult = await supabaseAdmin.rpc('search_businesses_ranked', {
      p_lat: lat,
      p_lng: lng,
      p_radius_km: radiusKm,
      p_city: filteredBody.city ?? null,
      p_area: filteredBody.area ?? null,
      p_pincode: filteredBody.pincode ?? null,
      p_category: filteredBody.category ?? null,
      p_available_today: !!filteredBody.available_today,
      p_min_rating: filteredBody.min_rating ?? null,
      p_limit: limit,
      p_offset: offset,
      p_distance_weight: DISCOVERY_WEIGHT_DISTANCE,
      p_rating_weight: DISCOVERY_WEIGHT_RATING,
      p_availability_weight: DISCOVERY_WEIGHT_AVAILABILITY,
      p_popularity_weight: DISCOVERY_WEIGHT_POPULARITY,
      p_repeat_weight: DISCOVERY_WEIGHT_REPEAT_CUSTOMER,
      p_rating_scale_max: DISCOVERY_RATING_SCALE_MAX,
      p_popularity_cap: DISCOVERY_POPULARITY_CAP,
      p_slot_window_days: DISCOVERY_SLOT_WINDOW_DAYS,
    });
    if (rpcResult.error) {
      rpcError = rpcResult.error;
      fallbackContext.usedFallback = true;
      fallbackContext.reason = 'rpc';
      const fallbackRows = await queryDiscoveryFallback(supabaseAdmin, {
        p_city: filteredBody.city ?? null,
        p_area: filteredBody.area ?? null,
        p_pincode: filteredBody.pincode ?? null,
        p_category: filteredBody.category ?? null,
        limit,
        offset,
      });
      ranked = fallbackRows as unknown[];
      logStructured('warn', 'Discovery fallback: RPC failed', {
        service: 'geo_service',
        failure_reason: 'rpc_error',
        timestamp: new Date().toISOString(),
        request_id: requestId ?? undefined,
        endpoint: DISCOVERY_ENDPOINT,
        fallback_used: true,
        fallback_reason: 'rpc',
      });
    } else {
      ranked = rpcResult.data ?? [];
    }

    if (rpcError !== null && ranked === null) {
      console.error('[GEO_SEARCH] RPC error:', rpcError);
      return errorResponse(ERROR_MESSAGES.DATABASE_ERROR, 500);
    }

    type RankedRow = {
      business_id: string;
      salon_name: string | null;
      location: string | null;
      category: string | null;
      latitude: number | null;
      longitude: number | null;
      area: string | null;
      distance_km: number | null;
      score: number;
      rating_avg: number;
      booking_count_30d: number;
      repeat_customer_ratio: number;
      slot_availability_ratio: number;
    };

    const results: RankedRow[] = (ranked ?? []) as RankedRow[];
    const hasMore = results.length === limit;

    // Optional: enrich top N with routed distance/time when geo provided
    let toReturn = results.map((r) => ({
      id: r.business_id,
      salon_name: r.salon_name,
      location: r.location || r.area || '',
      distance_km: r.distance_km ?? undefined,
      category: r.category || 'salon',
      latitude: r.latitude,
      longitude: r.longitude,
    }));

    if (hasGeo && lat !== null && lng !== null && toReturn.length > 0) {
      const { getRoute } = await import('@/lib/routing');
      const toEnrich = toReturn.slice(0, ROUTING_ENRICH_MAX_BUSINESSES);
      const enriched = await Promise.all(
        toEnrich.map(async (biz) => {
          const latNum = biz.latitude ?? 0;
          const lngNum = biz.longitude ?? 0;
          if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) return biz;
          try {
            const route = await getRoute({
              startLat: lat,
              startLng: lng,
              endLat: latNum,
              endLng: lngNum,
              mode: 'walking',
            });
            return {
              ...biz,
              distance_km: route.distance_km,
              estimated_time_minutes: route.estimated_time_minutes,
              is_routed: route.routed,
              route_source: route.source,
            };
          } catch {
            return biz;
          }
        })
      );
      const rest = toReturn.slice(ROUTING_ENRICH_MAX_BUSINESSES);
      toReturn = [...enriched, ...rest];
    }

    type BusinessResponseItem = {
      id: string;
      salon_name: string | null;
      location: string;
      distance_km?: number;
      category: string;
      estimated_time_minutes?: number;
      is_routed?: boolean;
      route_source?: string;
    };
    const response: {
      businesses: BusinessResponseItem[];
      pagination: { page: number; limit: number; total: number; has_more: boolean };
      explain_plan?: string[];
    } = {
      businesses: toReturn.map((b): BusinessResponseItem => {
        const item: BusinessResponseItem = {
          id: b.id,
          salon_name: b.salon_name,
          location: b.location,
          distance_km: b.distance_km,
          category: b.category,
        };
        const ext = b as {
          estimated_time_minutes?: number;
          is_routed?: boolean;
          route_source?: string;
        };
        if (ext.estimated_time_minutes !== undefined)
          item.estimated_time_minutes = ext.estimated_time_minutes;
        if (ext.is_routed !== undefined) item.is_routed = ext.is_routed;
        if (ext.route_source !== undefined) item.route_source = ext.route_source;
        return item;
      }),
      pagination: {
        page,
        limit,
        total: (page - 1) * limit + results.length,
        has_more: hasMore,
      },
    };

    if (fallbackContext.usedFallback && fallbackContext.reason) {
      if (fallbackContext.reason === 'geo_provider') {
        safeMetrics.increment(METRICS_DISCOVERY_FALLBACK_GEO);
      } else {
        safeMetrics.increment(METRICS_DISCOVERY_FALLBACK_RPC);
      }
    }

    if (filteredBody.explain === true && rpcError === null) {
      const { data: explainRows } = await supabaseAdmin.rpc(
        'get_search_businesses_ranked_explain',
        {
          p_lat: lat,
          p_lng: lng,
          p_radius_km: radiusKm,
          p_city: filteredBody.city ?? null,
          p_category: filteredBody.category ?? null,
          p_limit: limit,
          p_offset: offset,
        }
      );
      response.explain_plan = Array.isArray(explainRows)
        ? (explainRows as Record<string, string>[]).map((r) => r.plan_line ?? r['Query Plan'] ?? '')
        : [];
    }

    return successResponse(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Search failed';
    return errorResponse(message, 500);
  }
}
