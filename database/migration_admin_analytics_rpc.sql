-- Admin analytics: RPCs for revenue, funnel, and business health.
-- Index-friendly aggregations; UTC date filtering. Safe to run multiple times.

-- Revenue metrics: totals, trend by date, payment status distribution, revenue by business (top 5)
CREATE OR REPLACE FUNCTION get_admin_revenue_metrics(p_start TIMESTAMPTZ, p_end TIMESTAMPTZ)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_revenue BIGINT := 0;
  v_revenue_today BIGINT := 0;
  v_revenue_week BIGINT := 0;
  v_revenue_month BIGINT := 0;
  v_completed_count BIGINT := 0;
  v_failed_count BIGINT := 0;
  v_total_count BIGINT := 0;
  v_today_start TIMESTAMPTZ;
  v_week_start TIMESTAMPTZ;
  v_month_start TIMESTAMPTZ;
  v_trend JSON;
  v_status_dist JSON;
  v_by_business JSON;
  v_avg_booking_value NUMERIC := 0;
  v_success_rate NUMERIC := 0;
  v_failed_pct NUMERIC := 0;
BEGIN
  v_today_start := date_trunc('day', (p_end AT TIME ZONE 'UTC')) AT TIME ZONE 'UTC';
  v_week_start := v_today_start - INTERVAL '7 days';
  v_month_start := v_today_start - INTERVAL '30 days';

  -- Lifetime total revenue (completed) in range
  SELECT COALESCE(SUM(amount_cents), 0), COALESCE(COUNT(*), 0)
  INTO v_total_revenue, v_completed_count
  FROM payments
  WHERE status = 'completed'
    AND created_at >= p_start AND created_at <= p_end;

  -- Today / week / month revenue (completed)
  SELECT COALESCE(SUM(amount_cents), 0) INTO v_revenue_today
  FROM payments WHERE status = 'completed' AND created_at >= v_today_start AND created_at <= p_end;
  SELECT COALESCE(SUM(amount_cents), 0) INTO v_revenue_week
  FROM payments WHERE status = 'completed' AND created_at >= v_week_start AND created_at <= p_end;
  SELECT COALESCE(SUM(amount_cents), 0) INTO v_revenue_month
  FROM payments WHERE status = 'completed' AND created_at >= v_month_start AND created_at <= p_end;

  -- Failed count and total for success rate
  SELECT COALESCE(COUNT(*), 0) INTO v_failed_count
  FROM payments WHERE status IN ('failed', 'expired') AND created_at >= p_start AND created_at <= p_end;
  SELECT COALESCE(COUNT(*), 0) INTO v_total_count
  FROM payments WHERE created_at >= p_start AND created_at <= p_end;

  IF v_total_count > 0 THEN
    v_success_rate := ROUND((v_completed_count::NUMERIC / v_total_count::NUMERIC) * 100, 2);
    v_failed_pct := ROUND((v_failed_count::NUMERIC / v_total_count::NUMERIC) * 100, 2);
  END IF;
  IF v_completed_count > 0 THEN
    v_avg_booking_value := ROUND((v_total_revenue::NUMERIC / 100.0 / v_completed_count::NUMERIC), 2);
  END IF;

  -- Revenue trend by date (daily sum), ordered by date
  SELECT COALESCE(
    (SELECT json_agg(json_build_object('date', d::text, 'revenue', ROUND(COALESCE(cents, 0) / 100.0, 2)))
     FROM (
       SELECT date_trunc('day', created_at AT TIME ZONE 'UTC')::date AS d, SUM(amount_cents) AS cents
       FROM payments
       WHERE status = 'completed' AND created_at >= p_start AND created_at <= p_end
       GROUP BY date_trunc('day', created_at AT TIME ZONE 'UTC')::date
       ORDER BY d
     ) t),
    '[]'::json
  ) INTO v_trend;

  -- Payment status distribution
  SELECT COALESCE(
    json_agg(json_build_object('status', status, 'count', cnt)),
    '[]'::json
  ) INTO v_status_dist
  FROM (
    SELECT status, COUNT(*)::bigint AS cnt
    FROM payments
    WHERE created_at >= p_start AND created_at <= p_end
    GROUP BY status
  ) t;

  -- Revenue by business (top 5)
  SELECT COALESCE(
    (SELECT json_agg(json_build_object('business_id', business_id, 'name', name, 'revenue', ROUND(revenue_cents / 100.0, 2)))
     FROM (
       SELECT b.business_id, COALESCE(bu.salon_name, '') AS name, SUM(p.amount_cents) AS revenue_cents
       FROM payments p
       JOIN bookings b ON b.id = p.booking_id
       LEFT JOIN businesses bu ON bu.id = b.business_id
       WHERE p.status = 'completed' AND p.created_at >= p_start AND p.created_at <= p_end
       GROUP BY b.business_id, bu.salon_name
       ORDER BY revenue_cents DESC
       LIMIT 5
     ) top),
    '[]'::json
  ) INTO v_by_business;

  RETURN json_build_object(
    'totalRevenue', ROUND(v_total_revenue / 100.0, 2),
    'revenueToday', ROUND(v_revenue_today / 100.0, 2),
    'revenueWeek', ROUND(v_revenue_week / 100.0, 2),
    'revenueMonth', ROUND(v_revenue_month / 100.0, 2),
    'avgBookingValue', v_avg_booking_value,
    'paymentSuccessRate', v_success_rate,
    'failedPayments', v_failed_count,
    'failedPaymentsPct', v_failed_pct,
    'revenueTrend', COALESCE(v_trend, '[]'::json),
    'paymentStatusDistribution', COALESCE(v_status_dist, '[]'::json),
    'revenueByBusiness', COALESCE(v_by_business, '[]'::json)
  );
END;
$$;

-- Booking funnel: attempts, confirmed, rejected, cancelled, expired, conversion rate, avg time to accept, auto-expired %
CREATE OR REPLACE FUNCTION get_admin_booking_funnel(p_start TIMESTAMPTZ, p_end TIMESTAMPTZ)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempts BIGINT := 0;
  v_confirmed BIGINT := 0;
  v_rejected BIGINT := 0;
  v_cancelled BIGINT := 0;
  v_expired BIGINT := 0;
  v_conversion NUMERIC := 0;
  v_avg_mins NUMERIC := 0;
  v_auto_expired_pct NUMERIC := 0;
  v_expired_total BIGINT := 0;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'confirmed'),
    COUNT(*) FILTER (WHERE status = 'rejected'),
    COUNT(*) FILTER (WHERE status = 'cancelled' AND (cancelled_by IS NULL OR cancelled_by != 'system')),
    COUNT(*) FILTER (WHERE status = 'cancelled' AND cancelled_by = 'system')
  INTO v_attempts, v_confirmed, v_rejected, v_cancelled, v_expired
  FROM bookings
  WHERE created_at >= p_start AND created_at <= p_end;

  IF v_attempts > 0 THEN
    v_conversion := ROUND((v_confirmed::NUMERIC / v_attempts::NUMERIC) * 100, 2);
    v_expired_total := v_cancelled + v_expired;
    IF v_expired_total > 0 THEN
      v_auto_expired_pct := ROUND((v_expired::NUMERIC / v_expired_total::NUMERIC) * 100, 2);
    END IF;
  END IF;

  -- Avg time to accept: confirmed bookings, (updated_at - created_at) in minutes
  SELECT COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 60)::numeric, 2), 0)
  INTO v_avg_mins
  FROM bookings
  WHERE status = 'confirmed' AND created_at >= p_start AND created_at <= p_end;

  RETURN json_build_object(
    'attempts', v_attempts,
    'confirmed', v_confirmed,
    'rejected', v_rejected,
    'cancelled', v_cancelled,
    'expired', v_expired,
    'conversionRate', v_conversion,
    'avgTimeToAcceptMinutes', COALESCE(v_avg_mins, 0),
    'autoExpiredPct', COALESCE(v_auto_expired_pct, 0)
  );
END;
$$;

-- Business health: score 0-100, acceptance rate, cancellation rate, payment success rate, avg response time, revenue
CREATE OR REPLACE FUNCTION get_admin_business_health(p_limit INT, p_start TIMESTAMPTZ, p_end TIMESTAMPTZ)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  WITH booking_stats AS (
    SELECT
      b.business_id,
      COUNT(*) AS attempts,
      COUNT(*) FILTER (WHERE b.status = 'confirmed') AS confirmed,
      COUNT(*) FILTER (WHERE b.status = 'cancelled') AS cancelled,
      COUNT(*) FILTER (WHERE b.status = 'cancelled' AND b.cancelled_by = 'system') AS expired,
      AVG(CASE WHEN b.status = 'confirmed' THEN EXTRACT(EPOCH FROM (b.updated_at - b.created_at)) / 60 END) AS avg_response_mins
    FROM bookings b
    WHERE b.created_at >= p_start AND b.created_at <= p_end
    GROUP BY b.business_id
  ),
  payment_stats AS (
    SELECT
      bk.business_id,
      COUNT(*) FILTER (WHERE p.status = 'completed') AS completed,
      COUNT(*) AS total_payments
    FROM payments p
    JOIN bookings bk ON bk.id = p.booking_id
    WHERE p.created_at >= p_start AND p.created_at <= p_end
    GROUP BY bk.business_id
  ),
  revenue_per_biz AS (
    SELECT bk.business_id, SUM(p.amount_cents) / 100.0 AS revenue
    FROM payments p
    JOIN bookings bk ON bk.id = p.booking_id
    WHERE p.status = 'completed' AND p.created_at >= p_start AND p.created_at <= p_end
    GROUP BY bk.business_id
  ),
  combined AS (
    SELECT
      bu.id AS business_id,
      COALESCE(bu.salon_name, '') AS name,
      COALESCE(bs.attempts, 0) AS attempts,
      COALESCE(bs.confirmed, 0) AS confirmed,
      COALESCE(bs.cancelled, 0) AS cancelled,
      COALESCE(bs.expired, 0) AS expired,
      COALESCE(bs.avg_response_mins, 0) AS avg_response_mins,
      COALESCE(ps.completed, 0) AS pay_completed,
      COALESCE(ps.total_payments, 0) AS pay_total,
      COALESCE(r.revenue, 0) AS revenue
    FROM businesses bu
    LEFT JOIN booking_stats bs ON bs.business_id = bu.id
    LEFT JOIN payment_stats ps ON ps.business_id = bu.id
    LEFT JOIN revenue_per_biz r ON r.business_id = bu.id
    WHERE bs.attempts > 0 OR ps.total_payments > 0
  ),
  scored AS (
    SELECT
      business_id,
      name,
      attempts,
      -- acceptance rate: confirmed / attempts
      CASE WHEN attempts > 0 THEN ROUND((confirmed::NUMERIC / attempts::NUMERIC) * 100, 2) ELSE 0 END AS acceptance_rate,
      -- cancellation rate: cancelled / attempts
      CASE WHEN attempts > 0 THEN ROUND((cancelled::NUMERIC / attempts::NUMERIC) * 100, 2) ELSE 0 END AS cancellation_rate,
      -- payment success rate
      CASE WHEN pay_total > 0 THEN ROUND((pay_completed::NUMERIC / pay_total::NUMERIC) * 100, 2) ELSE 100 END AS payment_success_rate,
      avg_response_mins,
      revenue,
      -- Health: weighted. Higher acceptance + payment success + lower cancellation + faster response = better
      LEAST(100, GREATEST(0,
        (CASE WHEN attempts > 0 THEN (confirmed::NUMERIC / attempts::NUMERIC) * 35 ELSE 0 END) +
        (CASE WHEN pay_total > 0 THEN (pay_completed::NUMERIC / pay_total::NUMERIC) * 35 ELSE 35 END) +
        (CASE WHEN attempts > 0 THEN (1 - (cancelled::NUMERIC / attempts::NUMERIC)) * 15 ELSE 15 END) +
        (CASE WHEN avg_response_mins < 60 THEN 15 WHEN avg_response_mins < 1440 THEN 10 ELSE 5 END)
      ))::NUMERIC(5,2) AS health_score
    FROM combined
  )
  SELECT json_agg(
    json_build_object(
      'business_id', business_id,
      'name', name,
      'healthScore', health_score,
      'acceptanceRate', acceptance_rate,
      'cancellationRate', cancellation_rate,
      'paymentSuccessRate', payment_success_rate,
      'avgResponseTimeMinutes', ROUND(avg_response_mins, 2),
      'revenue', ROUND(revenue, 2)
    ) ORDER BY health_score ASC, attempts DESC
  ) INTO v_result
  FROM (SELECT * FROM scored ORDER BY health_score ASC LIMIT p_limit) sub;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

COMMENT ON FUNCTION get_admin_revenue_metrics IS 'Admin analytics: revenue metrics in date range. Uses indexed created_at.';
COMMENT ON FUNCTION get_admin_booking_funnel IS 'Admin analytics: booking funnel in date range.';
COMMENT ON FUNCTION get_admin_business_health IS 'Admin analytics: business health score, sorted by lowest first.';
