import { supabaseAdmin } from '@/lib/supabase/server';
import { ERROR_MESSAGES } from '@/config/constants';
import { mergeRecommendationScores } from '@/lib/recommendation/scoring';
import {
  RECOMMENDATION_NEARBY_DAYS,
  RECOMMENDATION_PAGE_MIN,
  RECOMMENDATION_PAGE_MAX,
  RECOMMENDATION_LIMIT_MIN,
  RECOMMENDATION_LIMIT_MAX,
  RECOMMENDATION_DEFAULT_LIMIT,
  RECOMMENDATION_DEFAULT_RADIUS_KM,
} from '@/config/constants';

export interface RecommendedBusiness {
  id: string;
  salon_name: string;
  location: string | null;
  category: string | null;
  booking_link: string;
  score: number;
}

export interface GetRecommendationsParams {
  userId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  radiusKm?: number;
  page?: number;
  limit?: number;
}

export interface GetRecommendationsResult {
  items: RecommendedBusiness[];
  total: number;
  page: number;
  limit: number;
}

/** In-memory cache: key -> { data, expiresAt }. Single-tenant; reset on deploy. */
const recommendationCache = new Map<
  string,
  { data: GetRecommendationsResult; expiresAt: number }
>();

function cacheKey(params: GetRecommendationsParams): string {
  const uid = params.userId ?? 'anon';
  const lat = params.latitude ?? '';
  const lng = params.longitude ?? '';
  const r = params.radiusKm ?? RECOMMENDATION_DEFAULT_RADIUS_KM;
  const page = params.page ?? RECOMMENDATION_PAGE_MIN;
  const limit = params.limit ?? RECOMMENDATION_DEFAULT_LIMIT;
  return `rec:${uid}:${lat}:${lng}:${r}:${page}:${limit}`;
}

/** Fetch previously booked business ids and counts for a user (RPC). */
async function getPreviouslyBookedScores(userId: string): Promise<Map<string, number>> {
  if (!supabaseAdmin) throw new Error('Database not configured');
  const { data, error } = await supabaseAdmin.rpc('get_previously_booked_business_ids', {
    p_customer_user_id: userId,
    p_limit: 100,
  });
  if (error) throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
  const rows = (data ?? []) as { business_id: string; booking_count: number }[];
  const maxCount = Math.max(1, ...rows.map((r) => r.booking_count));
  const map = new Map<string, number>();
  rows.forEach((r) => map.set(r.business_id, r.booking_count / maxCount));
  return map;
}

/** Max bookings to consider for frequent-service aggregation (indexed query). */
const RECOMMENDATION_FREQUENT_BOOKINGS_LIMIT = 5000;

/** Frequently booked services (last 30d): top service_ids then business_ids that offer them. */
async function getFrequentServiceBusinessScores(): Promise<Map<string, number>> {
  if (!supabaseAdmin) throw new Error('Database not configured');
  const since = new Date();
  since.setDate(since.getDate() - RECOMMENDATION_NEARBY_DAYS);
  const sinceIso = since.toISOString();

  const { data: recentBookings, error: bkError } = await supabaseAdmin
    .from('bookings')
    .select('id')
    .gte('created_at', sinceIso)
    .eq('status', 'confirmed')
    .limit(RECOMMENDATION_FREQUENT_BOOKINGS_LIMIT);
  if (bkError) throw new Error(bkError.message || ERROR_MESSAGES.DATABASE_ERROR);
  const bookingIds = (recentBookings ?? []).map((b) => b.id);
  if (bookingIds.length === 0) return new Map();

  const { data: bookingServices, error: bsError } = await supabaseAdmin
    .from('booking_services')
    .select('booking_id, service_id')
    .in('booking_id', bookingIds);
  if (bsError) throw new Error(bsError.message || ERROR_MESSAGES.DATABASE_ERROR);

  const serviceCounts = new Map<string, number>();
  (bookingServices ?? []).forEach((bs) => {
    const sid = bs.service_id as string;
    serviceCounts.set(sid, (serviceCounts.get(sid) ?? 0) + 1);
  });

  const topServiceIds = Array.from(serviceCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([id]) => id);
  if (topServiceIds.length === 0) return new Map();

  const { data: services, error: svError } = await supabaseAdmin
    .from('services')
    .select('id, business_id')
    .in('id', topServiceIds)
    .eq('is_active', true);
  if (svError) throw new Error(svError.message || ERROR_MESSAGES.DATABASE_ERROR);

  const maxCount = Math.max(1, ...topServiceIds.map((id) => serviceCounts.get(id) ?? 0));
  const businessScores = new Map<string, number>();
  (services ?? []).forEach((s) => {
    const bid = s.business_id as string;
    const serviceCount = serviceCounts.get(s.id) ?? 0;
    const norm = serviceCount / maxCount;
    businessScores.set(bid, Math.max(businessScores.get(bid) ?? 0, norm));
  });
  return businessScores;
}

/** Nearby popular businesses (RPC). */
async function getNearbyPopularScores(
  lat: number | null,
  lng: number | null,
  radiusKm: number,
  limit: number
): Promise<Map<string, number>> {
  if (!supabaseAdmin) throw new Error('Database not configured');
  const { data, error } = await supabaseAdmin.rpc('get_nearby_popular_businesses', {
    p_lat: lat ?? undefined,
    p_lng: lng ?? undefined,
    p_radius_km: radiusKm,
    p_days: RECOMMENDATION_NEARBY_DAYS,
    p_limit: limit * 2,
    p_offset: 0,
  });
  if (error) throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
  const rows = (data ?? []) as {
    business_id: string;
    booking_count_30d: number;
    distance_km?: number | null;
  }[];
  const maxCount = Math.max(1, ...rows.map((r) => r.booking_count_30d));
  const map = new Map<string, number>();
  rows.forEach((r) => map.set(r.business_id, r.booking_count_30d / maxCount));
  return map;
}

export async function getRecommendations(
  params: GetRecommendationsParams,
  cacheTtlSeconds: number
): Promise<GetRecommendationsResult> {
  const page = Math.max(
    RECOMMENDATION_PAGE_MIN,
    Math.min(RECOMMENDATION_PAGE_MAX, params.page ?? RECOMMENDATION_PAGE_MIN)
  );
  const limit = Math.max(
    RECOMMENDATION_LIMIT_MIN,
    Math.min(RECOMMENDATION_LIMIT_MAX, params.limit ?? RECOMMENDATION_DEFAULT_LIMIT)
  );
  const radiusKm = params.radiusKm ?? RECOMMENDATION_DEFAULT_RADIUS_KM;
  const key = cacheKey({ ...params, page, limit });
  const now = Date.now();
  const cached = recommendationCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const [prevScores, frequentScores, nearbyScores] = await Promise.all([
    params.userId
      ? getPreviouslyBookedScores(params.userId)
      : Promise.resolve(new Map<string, number>()),
    getFrequentServiceBusinessScores(),
    getNearbyPopularScores(params.latitude ?? null, params.longitude ?? null, radiusKm, limit * 3),
  ]);

  const merged = mergeRecommendationScores(prevScores, frequentScores, nearbyScores);
  const total = merged.length;
  const offset = (page - 1) * limit;
  const pageIds = merged.slice(offset, offset + limit);

  if (!supabaseAdmin) {
    throw new Error('Database not configured');
  }
  if (pageIds.length === 0) {
    const result: GetRecommendationsResult = {
      items: [],
      total: 0,
      page,
      limit,
    };
    recommendationCache.set(key, {
      data: result,
      expiresAt: now + cacheTtlSeconds * 1000,
    });
    return result;
  }

  const idToScore = new Map(pageIds.map((p) => [p.businessId, p.score]));
  const { data: businesses, error } = await supabaseAdmin
    .from('businesses')
    .select('id, salon_name, location, category, booking_link')
    .in(
      'id',
      pageIds.map((p) => p.businessId)
    )
    .eq('suspended', false)
    .is('deleted_at', null);
  if (error) throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);

  const items: RecommendedBusiness[] = (businesses ?? [])
    .map((b) => ({
      id: b.id,
      salon_name: b.salon_name,
      location: b.location ?? null,
      category: b.category ?? null,
      booking_link: b.booking_link,
      score: idToScore.get(b.id) ?? 0,
    }))
    .sort((a, b) => b.score - a.score);

  const result: GetRecommendationsResult = {
    items,
    total,
    page,
    limit,
  };
  recommendationCache.set(key, {
    data: result,
    expiresAt: now + cacheTtlSeconds * 1000,
  });
  return result;
}
