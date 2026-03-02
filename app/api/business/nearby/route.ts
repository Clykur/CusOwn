import { NextRequest } from 'next/server';
import { requireSupabaseAdmin } from '@/lib/supabase/server';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { haversineDistance } from '@/lib/utils/geo';
import { ERROR_MESSAGES } from '@/config/constants';

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

    const lat = parseFloat(latStr || '');
    const lng = parseFloat(lngStr || '');

    if (isNaN(lat) || isNaN(lng)) {
      return errorResponse(ERROR_MESSAGES.INVALID_INPUT, 400);
    }

    // 1. Compute bounding box
    const deltaLat = radius / 111;
    const deltaLng = radius / (111 * Math.cos(lat * (Math.PI / 180)));

    const minLat = lat - deltaLat;
    const maxLat = lat + deltaLat;
    const minLng = lng - deltaLng;
    const maxLng = lng + deltaLng;

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

    // 3. Compute Haversine distance and sort
    const businessesWithDistance = (businesses || [])
      .map((business) => {
        const distance = haversineDistance(
          lat,
          lng,
          parseFloat(business.latitude),
          parseFloat(business.longitude)
        );
        return { ...business, distance_km: distance };
      })
      .filter((business) => business.distance_km <= radius) // strictly within radius
      .sort((a, b) => a.distance_km - b.distance_km)
      .slice(0, 50);

    return successResponse(businessesWithDistance);
  } catch (error) {
    console.error(`[API:${ROUTE}] Error:`, error);
    return errorResponse(ERROR_MESSAGES.DATABASE_ERROR, 500);
  }
}
