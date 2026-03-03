import { NextRequest } from 'next/server';
import { requireSupabaseAdmin } from '@/lib/supabase/server';
import { successResponse, errorResponse } from '@/lib/utils/response';
import {
  haversineDistance,
  parseAndValidateCoordinates,
  boundingBox,
  validateRadius,
} from '@/lib/utils/geo';
import { ERROR_MESSAGES, ROUTING_ENRICH_MAX_BUSINESSES } from '@/config/constants';

const ROUTE = 'GET /api/business/nearby';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const latStr = searchParams.get('lat');
    const lngStr = searchParams.get('lng');
    const city = searchParams.get('city');
    const radius = parseFloat(searchParams.get('radius') || '10');

    const supabaseAdmin = requireSupabaseAdmin();

    // FALLBACK: If no coordinates but we have a city, do a city-based search
    if ((!latStr || !lngStr) && city) {
      const { data: businesses, error: cityError } = await supabaseAdmin
        .from('businesses')
        .select('*')
        .or(`city.ilike.%${city}%,location.ilike.%${city}%,address.ilike.%${city}%`)
        .limit(50);

      if (cityError) throw cityError;
      return successResponse(businesses || []);
    }

    let lat: number;
    let lng: number;
    try {
      ({ lat, lng } = parseAndValidateCoordinates(latStr, lngStr));
    } catch (e) {
      return errorResponse(ERROR_MESSAGES.INVALID_INPUT, 400);
    }

    if (!validateRadius(radius)) return errorResponse(ERROR_MESSAGES.INVALID_INPUT, 400);

    // 1. Compute bounding box
    const { minLat, maxLat, minLng, maxLng } = boundingBox(lat, lng, radius);

    // 2. Query businesses within bounding box
    const { data: businesses, error: dbError } = await supabaseAdmin
      .from('businesses')
      .select('*')
      .gte('latitude', minLat)
      .lte('latitude', maxLat)
      .gte('longitude', minLng)
      .lte('longitude', maxLng)
      .limit(100); // safety limit

    if (dbError) throw dbError;

    // 3. Compute Haversine distance, filter by radius, sort
    const userLat = lat;
    const userLng = lng;

    type BusinessWithDistance = Record<string, unknown> & {
      distance_km: number;
      estimated_time_minutes?: number;
      is_routed?: boolean;
      route_source?: string;
    };

    let businessesWithDistance: BusinessWithDistance[] = (businesses || [])
      .map((business) => {
        const bizLat = Number(business.latitude);
        const bizLng = Number(business.longitude);
        if (!Number.isFinite(bizLat) || !Number.isFinite(bizLng)) return null;

        const distance = haversineDistance(userLat, userLng, bizLat, bizLng);
        if (!Number.isFinite(distance) || distance > radius) return null;
        return { ...business, distance_km: distance } as BusinessWithDistance;
      })
      .filter((b): b is BusinessWithDistance => b !== null);

    businessesWithDistance.sort((a, b) => a.distance_km - b.distance_km);
    const toReturn = businessesWithDistance.slice(0, 50);

    // Enrich only top N with routed distance/time to limit parallel routing calls
    const toEnrich = toReturn.slice(0, ROUTING_ENRICH_MAX_BUSINESSES);
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
          } as BusinessWithDistance;
        } catch {
          return biz;
        }
      })
    );

    const rest = toReturn.slice(ROUTING_ENRICH_MAX_BUSINESSES);
    const businessesWithDistanceFinal = [...enriched, ...rest];

    return successResponse(businessesWithDistanceFinal);
  } catch (error) {
    console.error(`[API:${ROUTE}] Error:`, error);
    return errorResponse(ERROR_MESSAGES.DATABASE_ERROR, 500);
  }
}
