import type { SupabaseClient } from '@supabase/supabase-js';
import { applyActiveBusinessFilters } from '@/lib/db/business-query-filters';

export interface DiscoveryFallbackRow {
  business_id: string;
  salon_name: string | null;
  location: string | null;
  category: string | null;
  latitude: number | null;
  longitude: number | null;
  area: string | null;
  distance_km: null;
  score: number;
  rating_avg: number;
  booking_count_30d: number;
  repeat_customer_ratio: number;
  slot_availability_ratio: number;
}

export interface DiscoveryFallbackParams {
  p_city: string | null;
  p_area: string | null;
  p_pincode: string | null;
  p_category: string | null;
  limit: number;
  offset: number;
}

export async function queryDiscoveryFallback(
  supabase: SupabaseClient,
  params: DiscoveryFallbackParams
): Promise<DiscoveryFallbackRow[]> {
  let query = supabase
    .from('businesses')
    .select('id, salon_name, location, category, latitude, longitude, area, created_at')
    .order('created_at', { ascending: false });
  query = applyActiveBusinessFilters(query);

  if (params.p_category) {
    query = query.eq('category', params.p_category);
  }
  if (params.p_pincode) {
    query = query.eq('pincode', params.p_pincode);
  } else if (params.p_city) {
    query = query.eq('city', params.p_city);
    if (params.p_area) {
      query = query.eq('area', params.p_area);
    }
  }

  const { data: rows, error } = await query.range(params.offset, params.offset + params.limit - 1);
  if (error) return [];

  return (rows ?? []).map((r: Record<string, unknown>) => ({
    business_id: r.id as string,
    salon_name: (r.salon_name as string | null) ?? null,
    location: (r.location as string | null) ?? null,
    category: (r.category as string | null) ?? null,
    latitude: (r.latitude as number | null) ?? null,
    longitude: (r.longitude as number | null) ?? null,
    area: (r.area as string | null) ?? null,
    distance_km: null,
    score: 0,
    rating_avg: 0,
    booking_count_30d: 0,
    repeat_customer_ratio: 0,
    slot_availability_ratio: 0,
  }));
}
