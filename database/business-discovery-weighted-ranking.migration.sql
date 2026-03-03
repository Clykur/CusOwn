-- Migration: Weighted ranking for business discovery.
-- Replaces distance-only sort with deterministic score: distance, rating, availability, popularity, repeat ratio.
-- Uses indexed aggregates; supports 10k+ businesses with pagination.

-- =============================================================================
-- 1. Business ratings table (for rating_avg aggregate)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.business_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  rating NUMERIC(3,2) NOT NULL CHECK (rating >= 0 AND rating <= 5),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_business_ratings_business_id
  ON public.business_ratings(business_id);

COMMENT ON TABLE public.business_ratings IS 'Per-business ratings for discovery ranking; aggregate AVG used in score.';

-- =============================================================================
-- 2. Indexes for ranked search aggregates (avoid seq scans)
-- =============================================================================
-- Bookings: count last 30 days per business
CREATE INDEX IF NOT EXISTS idx_bookings_business_created_at
  ON public.bookings(business_id, created_at DESC);

-- Bookings: repeat customer ratio (business_id + customer_user_id for distinct counts)
CREATE INDEX IF NOT EXISTS idx_bookings_business_customer
  ON public.bookings(business_id, customer_user_id)
  WHERE status = 'confirmed' AND customer_user_id IS NOT NULL;

-- Slots: availability ratio (business_id, date range, status)
CREATE INDEX IF NOT EXISTS idx_slots_business_date_status
  ON public.slots(business_id, date, status);

-- =============================================================================
-- 3. Composite indexes for filter + ordering (active businesses, location, category)
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_businesses_active_category_city
  ON public.businesses(category, city, id)
  WHERE suspended = false AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_businesses_active_category_pincode
  ON public.businesses(category, pincode, id)
  WHERE suspended = false AND deleted_at IS NULL AND pincode IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_businesses_active_geo
  ON public.businesses(latitude, longitude, id)
  WHERE suspended = false AND deleted_at IS NULL AND latitude IS NOT NULL AND longitude IS NOT NULL;

-- =============================================================================
-- 4. RPC: search_businesses_ranked
-- Score = (distance_weight * norm_distance) * (rating_weight * norm_rating) * ...
-- All norms 0-1. ORDER BY score DESC, business_id ASC. Pagination mandatory.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.search_businesses_ranked(
  p_lat DOUBLE PRECISION DEFAULT NULL,
  p_lng DOUBLE PRECISION DEFAULT NULL,
  p_radius_km DOUBLE PRECISION DEFAULT 10,
  p_city TEXT DEFAULT NULL,
  p_area TEXT DEFAULT NULL,
  p_pincode TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_available_today BOOLEAN DEFAULT FALSE,
  p_min_rating DOUBLE PRECISION DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0,
  p_distance_weight DOUBLE PRECISION DEFAULT 0.25,
  p_rating_weight DOUBLE PRECISION DEFAULT 0.25,
  p_availability_weight DOUBLE PRECISION DEFAULT 0.2,
  p_popularity_weight DOUBLE PRECISION DEFAULT 0.15,
  p_repeat_weight DOUBLE PRECISION DEFAULT 0.15,
  p_rating_scale_max DOUBLE PRECISION DEFAULT 5,
  p_popularity_cap INTEGER DEFAULT 100,
  p_slot_window_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  business_id UUID,
  salon_name TEXT,
  location TEXT,
  category TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  area TEXT,
  distance_km DOUBLE PRECISION,
  score DOUBLE PRECISION,
  rating_avg DOUBLE PRECISION,
  booking_count_30d BIGINT,
  repeat_customer_ratio DOUBLE PRECISION,
  slot_availability_ratio DOUBLE PRECISION
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_radius_km DOUBLE PRECISION := GREATEST(0.1, LEAST(200, COALESCE(p_radius_km, 10)));
  v_limit INT := GREATEST(1, LEAST(100, COALESCE(p_limit, 20)));
  v_offset INT := GREATEST(0, COALESCE(p_offset, 0));
  v_eps DOUBLE PRECISION := 1e-6;
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT b.id, b.salon_name, b.location, b.category, b.latitude::DOUBLE PRECISION AS lat, b.longitude::DOUBLE PRECISION AS lng, b.area
    FROM public.businesses b
    WHERE b.suspended = false
      AND b.deleted_at IS NULL
      AND (p_category IS NULL OR b.category = p_category)
      AND (
        (p_pincode IS NOT NULL AND b.pincode = p_pincode)
        OR (p_city IS NOT NULL AND b.city = p_city AND (p_area IS NULL OR b.area = p_area))
        OR (p_lat IS NOT NULL AND p_lng IS NOT NULL AND b.latitude IS NOT NULL AND b.longitude IS NOT NULL
            AND (6371.0 * acos(LEAST(1, GREATEST(-1,
              cos(radians(p_lat)) * cos(radians(b.latitude::DOUBLE PRECISION)) * cos(radians(b.longitude::DOUBLE PRECISION) - radians(p_lng))
              + sin(radians(p_lat)) * sin(radians(b.latitude::DOUBLE PRECISION)))))) <= v_radius_km)
      )
      AND (NOT p_available_today OR EXISTS (
        SELECT 1 FROM public.slots s
        WHERE s.business_id = b.id AND s.date = CURRENT_DATE AND s.status = 'available'
          AND s.start_time >= CURRENT_TIME
      ))
  ),
  agg AS (
    SELECT
      c.id,
      c.salon_name,
      c.location,
      c.category,
      c.lat AS latitude,
      c.lng AS longitude,
      c.area,
      CASE WHEN p_lat IS NOT NULL AND p_lng IS NOT NULL AND c.lat IS NOT NULL AND c.lng IS NOT NULL
        THEN (6371.0 * acos(LEAST(1, GREATEST(-1,
          cos(radians(p_lat)) * cos(radians(c.lat)) * cos(radians(c.lng) - radians(p_lng))
          + sin(radians(p_lat)) * sin(radians(c.lat))))))
        ELSE NULL
      END AS distance_km,
      (SELECT COALESCE(AVG(r.rating), 0) FROM public.business_ratings r WHERE r.business_id = c.id) AS rating_avg,
      (SELECT COUNT(*) FROM public.bookings bk WHERE bk.business_id = c.id AND bk.created_at >= (CURRENT_TIMESTAMP - (p_slot_window_days || ' days')::INTERVAL)) AS booking_count_30d,
      (SELECT
        CASE WHEN total_cust = 0 THEN 0
        ELSE repeat_cust::DOUBLE PRECISION / NULLIF(total_cust, 0) END
       FROM (
         SELECT
           (SELECT COUNT(DISTINCT customer_user_id) FROM public.bookings WHERE business_id = c.id AND status = 'confirmed' AND customer_user_id IS NOT NULL) AS total_cust,
           (SELECT COUNT(*) FROM (
             SELECT customer_user_id FROM public.bookings
             WHERE business_id = c.id AND status = 'confirmed' AND customer_user_id IS NOT NULL
             GROUP BY customer_user_id HAVING COUNT(*) >= 2
           ) rep) AS repeat_cust
       ) rr
      ) AS repeat_ratio,
      (SELECT
        CASE WHEN x.total = 0 THEN 0 ELSE LEAST(1, x.avail::DOUBLE PRECISION / x.total) END
       FROM (
         SELECT
           COUNT(*) FILTER (WHERE s.status = 'available') AS avail,
           COUNT(*) AS total
         FROM public.slots s
         WHERE s.business_id = c.id AND s.date >= CURRENT_DATE AND s.date < (CURRENT_DATE + (p_slot_window_days || ' days')::INTEGER)
       ) x
      ) AS slot_availability_ratio
    FROM candidates c
    WHERE (p_min_rating IS NULL OR (SELECT COALESCE(AVG(r.rating), 0) FROM public.business_ratings r WHERE r.business_id = c.id) >= p_min_rating)
      AND (p_lat IS NULL OR p_lng IS NULL OR (6371.0 * acos(LEAST(1, GREATEST(-1,
        cos(radians(p_lat)) * cos(radians(c.lat)) * cos(radians(c.lng) - radians(p_lng))
        + sin(radians(p_lat)) * sin(radians(c.lat)))))) <= v_radius_km)
  ),
  scored AS (
    SELECT
      a.id AS business_id,
      a.salon_name,
      a.location,
      a.category,
      a.latitude,
      a.longitude,
      a.area,
      a.distance_km,
      a.rating_avg,
      a.booking_count_30d,
      a.repeat_ratio AS repeat_customer_ratio,
      a.slot_availability_ratio,
      (
        (p_distance_weight * (CASE WHEN a.distance_km IS NULL THEN 1
          ELSE GREATEST(v_eps, 1 - LEAST(1, a.distance_km / v_radius_km)) END))
        * (p_rating_weight * GREATEST(v_eps, LEAST(1, a.rating_avg / NULLIF(p_rating_scale_max, 0))))
        * (p_availability_weight * GREATEST(v_eps, COALESCE(a.slot_availability_ratio, 0)))
        * (p_popularity_weight * GREATEST(v_eps, LEAST(1, a.booking_count_30d::DOUBLE PRECISION / NULLIF(p_popularity_cap, 0))))
        * (p_repeat_weight * GREATEST(v_eps, COALESCE(a.repeat_ratio, 0)))
      ) AS score
    FROM agg a
  )
  SELECT
    s.business_id,
    s.salon_name,
    s.location,
    s.category,
    s.latitude,
    s.longitude,
    s.area,
    s.distance_km,
    s.score,
    s.rating_avg,
    s.booking_count_30d,
    s.repeat_customer_ratio,
    s.slot_availability_ratio
  FROM scored s
  ORDER BY s.score DESC NULLS LAST, s.business_id ASC
  LIMIT v_limit
  OFFSET v_offset;
END;
$$;

COMMENT ON FUNCTION public.search_businesses_ranked IS 'Business discovery with weighted ranking: distance, rating, availability, popularity, repeat ratio. Deterministic ORDER BY score DESC, business_id ASC. Pagination mandatory.';

-- =============================================================================
-- 5. RPC: get_search_businesses_ranked_explain (returns EXPLAIN plan for verification)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_search_businesses_ranked_explain(
  p_lat DOUBLE PRECISION DEFAULT NULL,
  p_lng DOUBLE PRECISION DEFAULT NULL,
  p_radius_km DOUBLE PRECISION DEFAULT 10,
  p_city TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (plan_line TEXT)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY EXECUTE format(
    'EXPLAIN (FORMAT TEXT, COSTS) SELECT * FROM public.search_businesses_ranked(%L, %L, %L, %L, %L, %L, %L, false, NULL::double precision, %s, %s)',
    p_lat, p_lng, p_radius_km, p_city, NULL::TEXT, NULL::TEXT, p_category, p_limit, p_offset
  );
END;
$$;

COMMENT ON FUNCTION public.get_search_businesses_ranked_explain IS 'Returns EXPLAIN plan for search_businesses_ranked to verify index usage.';
