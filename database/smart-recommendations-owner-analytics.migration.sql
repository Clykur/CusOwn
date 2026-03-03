-- Migration: Smart recommendations + advanced owner analytics.
-- Indexes for recommendation and analytics aggregations; RPC for owner analytics (indexed, no seq scans).
-- Safe to run once. Idempotent.

-- =============================================================================
-- 1. Indexes for recommendation queries
-- =============================================================================
-- Previously booked businesses: by customer_user_id + business_id (count/list).
CREATE INDEX IF NOT EXISTS idx_bookings_customer_user_business
  ON public.bookings(customer_user_id, business_id)
  WHERE customer_user_id IS NOT NULL;

-- Owner analytics: slots by business + date for peak hour (hour from start_time).
-- bookings(business_id, status, created_at) already covered by idx_bookings_business_status_created etc.
-- Ensure we have business_id + created_at for revenue/trend (idx_bookings_business_created_at exists).

-- =============================================================================
-- 2. RPC: get_owner_analytics_advanced
-- Returns: peak_hours_heatmap (group by hour), repeat_customer_pct, cancellation_rate,
--          revenue_trend (daily last 30d), service_popularity_ranking.
-- All use indexed columns; pagination via p_limit for service ranking.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_owner_analytics_advanced(
  p_business_id UUID,
  p_start_date DATE DEFAULT (CURRENT_DATE - INTERVAL '30 days')::DATE,
  p_end_date DATE DEFAULT CURRENT_DATE,
  p_service_rank_limit INTEGER DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_peak_hours JSONB;
  v_repeat_pct NUMERIC := 0;
  v_cancellation_rate NUMERIC := 0;
  v_revenue_trend JSONB;
  v_service_ranking JSONB;
  v_total_confirmed BIGINT := 0;
  v_total_cancelled BIGINT := 0;
  v_total_attempts BIGINT := 0;
  v_customers_with_booking BIGINT := 0;
  v_repeat_customers BIGINT := 0;
BEGIN
  -- Peak hours heatmap: group by hour (0-23) from slots.start_time for confirmed bookings in range.
  SELECT COALESCE(
    (SELECT jsonb_agg(jsonb_build_object('hour', hour, 'bookingCount', booking_count) ORDER BY hour)
     FROM (
       SELECT (EXTRACT(HOUR FROM s.start_time))::INTEGER AS hour,
              COUNT(*)::BIGINT AS booking_count
       FROM bookings b
       JOIN slots s ON s.id = b.slot_id
       WHERE b.business_id = p_business_id
         AND b.status = 'confirmed'
         AND s.date >= p_start_date AND s.date <= p_end_date
       GROUP BY EXTRACT(HOUR FROM s.start_time)
     ) t),
    '[]'::jsonb
  ) INTO v_peak_hours;

  -- Totals for cancellation rate and repeat %
  SELECT
    COUNT(*) FILTER (WHERE status = 'confirmed'),
    COUNT(*) FILTER (WHERE status = 'cancelled'),
    COUNT(*)
  INTO v_total_confirmed, v_total_cancelled, v_total_attempts
  FROM bookings
  WHERE business_id = p_business_id
    AND created_at >= ((p_start_date::DATE AT TIME ZONE 'UTC')::TIMESTAMPTZ)
    AND created_at < (((p_end_date + 1)::DATE) AT TIME ZONE 'UTC')::TIMESTAMPTZ;

  IF v_total_attempts > 0 THEN
    v_cancellation_rate := ROUND((v_total_cancelled::NUMERIC / v_total_attempts::NUMERIC) * 100, 2);
  END IF;

  -- Repeat customer %: (customers with >= 2 confirmed bookings) / (customers with >= 1 confirmed booking) * 100
  WITH by_customer AS (
    SELECT COALESCE(b.customer_user_id::TEXT, b.customer_phone) AS cust_key,
           COUNT(*) AS cnt
    FROM bookings b
    WHERE b.business_id = p_business_id AND b.status = 'confirmed'
      AND (b.customer_user_id IS NOT NULL OR b.customer_phone IS NOT NULL)
      AND b.created_at >= ((p_start_date::DATE AT TIME ZONE 'UTC')::TIMESTAMPTZ)
      AND b.created_at < (((p_end_date + 1)::DATE) AT TIME ZONE 'UTC')::TIMESTAMPTZ
    GROUP BY COALESCE(b.customer_user_id::TEXT, b.customer_phone)
  )
  SELECT
    COUNT(*) FILTER (WHERE cnt >= 1),
    COUNT(*) FILTER (WHERE cnt >= 2)
  INTO v_customers_with_booking, v_repeat_customers
  FROM by_customer;

  IF v_customers_with_booking > 0 THEN
    v_repeat_pct := ROUND((v_repeat_customers::NUMERIC / v_customers_with_booking::NUMERIC) * 100, 2);
  END IF;

  -- Revenue trend: daily sum of total_price_cents for confirmed bookings (indexed by business_id, created_at).
  SELECT COALESCE(
    (SELECT jsonb_agg(jsonb_build_object('date', d, 'revenueCents', cents) ORDER BY d)
     FROM (
       SELECT (created_at AT TIME ZONE 'UTC')::DATE AS d,
              COALESCE(SUM(total_price_cents), 0)::BIGINT AS cents
       FROM bookings
       WHERE business_id = p_business_id AND status = 'confirmed'
         AND created_at >= ((p_start_date::DATE AT TIME ZONE 'UTC')::TIMESTAMPTZ)
         AND created_at < (((p_end_date + 1)::DATE) AT TIME ZONE 'UTC')::TIMESTAMPTZ
       GROUP BY (created_at AT TIME ZONE 'UTC')::DATE
     ) t),
    '[]'::jsonb
  ) INTO v_revenue_trend;

  -- Service popularity ranking: count bookings per service in range, order by count desc, limit.
  SELECT COALESCE(
    (SELECT jsonb_agg(jsonb_build_object('serviceId', service_id, 'serviceName', service_name, 'bookingCount', booking_count) ORDER BY booking_count DESC)
     FROM (
       SELECT sv.id AS service_id, sv.name AS service_name, COUNT(bs.booking_id)::BIGINT AS booking_count
       FROM services sv
       LEFT JOIN booking_services bs ON bs.service_id = sv.id
       LEFT JOIN bookings bk ON bk.id = bs.booking_id
         AND bk.business_id = p_business_id
         AND bk.status IN ('confirmed', 'pending', 'cancelled')
         AND bk.created_at >= ((p_start_date::DATE AT TIME ZONE 'UTC')::TIMESTAMPTZ)
         AND bk.created_at < (((p_end_date + 1)::DATE) AT TIME ZONE 'UTC')::TIMESTAMPTZ
       WHERE sv.business_id = p_business_id AND sv.is_active = true
       GROUP BY sv.id, sv.name
       ORDER BY booking_count DESC, sv.name
       LIMIT GREATEST(1, LEAST(500, COALESCE(p_service_rank_limit, 50)))
     ) t),
    '[]'::jsonb
  ) INTO v_service_ranking;

  RETURN jsonb_build_object(
    'peakHoursHeatmap', v_peak_hours,
    'repeatCustomerPercentage', v_repeat_pct,
    'cancellationRate', v_cancellation_rate,
    'revenueTrend', v_revenue_trend,
    'servicePopularityRanking', v_service_ranking,
    'totalConfirmed', v_total_confirmed,
    'totalCancelled', v_total_cancelled,
    'totalAttempts', v_total_attempts
  );
END;
$$;

COMMENT ON FUNCTION public.get_owner_analytics_advanced IS 'Owner analytics: peak hours, repeat %, cancellation rate, revenue trend, service ranking. Indexed aggregations.';

-- =============================================================================
-- 3. RPC: get_previously_booked_business_ids (for recommendations)
-- Returns list of business_ids for a user, ordered by booking count desc (weight for scoring).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_previously_booked_business_ids(
  p_customer_user_id UUID,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (business_id UUID, booking_count BIGINT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT b.business_id, COUNT(*)::BIGINT
  FROM bookings b
  WHERE b.customer_user_id = p_customer_user_id
    AND b.status IN ('confirmed', 'pending')
  GROUP BY b.business_id
  ORDER BY COUNT(*) DESC, b.business_id
  LIMIT GREATEST(1, LEAST(500, COALESCE(p_limit, 100)));
END;
$$;

COMMENT ON FUNCTION public.get_previously_booked_business_ids IS 'Recommendations: businesses user previously booked; indexed by customer_user_id, business_id.';

-- =============================================================================
-- 4. RPC: get_nearby_popular_businesses (last 30d booking count, optional geo filter)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_nearby_popular_businesses(
  p_lat DOUBLE PRECISION DEFAULT NULL,
  p_lng DOUBLE PRECISION DEFAULT NULL,
  p_radius_km DOUBLE PRECISION DEFAULT 25,
  p_days INTEGER DEFAULT 30,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  business_id UUID,
  booking_count_30d BIGINT,
  distance_km DOUBLE PRECISION
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_radius DOUBLE PRECISION := GREATEST(0.1, LEAST(200, COALESCE(p_radius_km, 25)));
  v_limit INT := GREATEST(1, LEAST(100, COALESCE(p_limit, 50)));
  v_offset INT := GREATEST(0, COALESCE(p_offset, 0));
  v_since TIMESTAMPTZ := (CURRENT_DATE - (COALESCE(p_days, 30) || ' days')::INTERVAL)::TIMESTAMPTZ;
BEGIN
  IF p_lat IS NOT NULL AND p_lng IS NOT NULL THEN
    RETURN QUERY
    WITH recent AS (
      SELECT bk.business_id, COUNT(*)::BIGINT AS cnt
      FROM bookings bk
      WHERE bk.created_at >= v_since
      GROUP BY bk.business_id
    ),
    with_dist AS (
      SELECT bu.id AS bid, bu.latitude AS blat, bu.longitude AS blng, COALESCE(r.cnt, 0)::BIGINT AS cnt
      FROM businesses bu
      LEFT JOIN recent r ON r.business_id = bu.id
      WHERE bu.suspended = false AND bu.deleted_at IS NULL
        AND bu.latitude IS NOT NULL AND bu.longitude IS NOT NULL
    )
    SELECT
      wd.bid AS business_id,
      wd.cnt AS booking_count_30d,
      (6371.0 * acos(LEAST(1, GREATEST(-1,
        cos(radians(p_lat)) * cos(radians(wd.blat)) * cos(radians(wd.blng) - radians(p_lng))
        + sin(radians(p_lat)) * sin(radians(wd.blat))))))::DOUBLE PRECISION AS distance_km
    FROM with_dist wd
    WHERE (6371.0 * acos(LEAST(1, GREATEST(-1,
      cos(radians(p_lat)) * cos(radians(wd.blat)) * cos(radians(wd.blng) - radians(p_lng))
      + sin(radians(p_lat)) * sin(radians(wd.blat)))))) <= v_radius
    ORDER BY wd.cnt DESC, wd.bid
    LIMIT v_limit OFFSET v_offset;
  ELSE
    RETURN QUERY
    SELECT bk.business_id, COUNT(*)::BIGINT AS booking_count_30d, NULL::DOUBLE PRECISION AS distance_km
    FROM bookings bk
    WHERE bk.created_at >= v_since
    GROUP BY bk.business_id
    ORDER BY COUNT(*) DESC, bk.business_id
    LIMIT v_limit OFFSET v_offset;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.get_nearby_popular_businesses IS 'Recommendations: popular businesses by 30d bookings; optional lat/lng/radius for nearby.';
