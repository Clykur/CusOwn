-- Migration: Query performance – hot path and metrics
-- 1. create_booking_atomically: remove metrics table read from hot path (use constant default).
-- 2. record_timing: INSERT-only; move cleanup to periodic job so every call is fast.
-- Safe to run once. Run after migration_supabase_linter_remediation.sql if used.

-- =============================================================================
-- 1. create_booking_atomically – no metrics read on every call
-- =============================================================================
-- Slot expiry is fixed at 10 minutes. To make it configurable later, use
-- config in app and pass as optional param, or run a one-off UPDATE on metrics.

CREATE OR REPLACE FUNCTION create_booking_atomically(
  p_business_id UUID,
  p_slot_id UUID,
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_booking_id TEXT,
  p_customer_user_id UUID DEFAULT NULL,
  p_total_duration_minutes INTEGER DEFAULT NULL,
  p_total_price_cents INTEGER DEFAULT NULL,
  p_services_count INTEGER DEFAULT 1,
  p_service_data JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_slot_status TEXT;
  v_slot_business_id UUID;
  v_business_suspended BOOLEAN;
  v_reserved_until TIMESTAMP WITH TIME ZONE;
  v_booking_uuid UUID;
  v_reservation_expiry TIMESTAMP WITH TIME ZONE;
  v_slot_expiry_minutes CONSTANT INTEGER := 10;
BEGIN
  SELECT s.status, s.business_id, s.reserved_until, b.suspended
  INTO v_slot_status, v_slot_business_id, v_reserved_until, v_business_suspended
  FROM slots s
  JOIN businesses b ON s.business_id = b.id
  WHERE s.id = p_slot_id
  FOR UPDATE OF s, b;

  IF v_slot_status IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Slot not found');
  END IF;

  IF v_slot_business_id != p_business_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Slot does not belong to business');
  END IF;

  IF v_business_suspended = true THEN
    RETURN jsonb_build_object('success', false, 'error', 'Business is suspended');
  END IF;

  IF v_slot_status = 'booked' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Slot already booked');
  END IF;

  IF v_slot_status = 'reserved' AND v_reserved_until IS NOT NULL THEN
    IF v_reserved_until > NOW() THEN
      RETURN jsonb_build_object('success', false, 'error', 'Slot is reserved');
    END IF;
  END IF;

  v_reservation_expiry := NOW() + (v_slot_expiry_minutes || ' minutes')::INTERVAL;

  UPDATE slots
  SET status = 'reserved',
      reserved_until = v_reservation_expiry
  WHERE id = p_slot_id
    AND status IN ('available', 'reserved')
    AND (reserved_until IS NULL OR reserved_until < NOW());

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Slot reservation failed');
  END IF;

  INSERT INTO bookings (
    business_id,
    slot_id,
    customer_name,
    customer_phone,
    booking_id,
    status,
    customer_user_id,
    total_duration_minutes,
    total_price_cents,
    services_count
  ) VALUES (
    p_business_id,
    p_slot_id,
    p_customer_name,
    p_customer_phone,
    p_booking_id,
    'pending',
    p_customer_user_id,
    p_total_duration_minutes,
    p_total_price_cents,
    p_services_count
  )
  RETURNING id INTO v_booking_uuid;

  IF p_service_data IS NOT NULL THEN
    INSERT INTO booking_services (booking_id, service_id, price_cents)
    SELECT
      v_booking_uuid,
      (elem->>'service_id')::UUID,
      (elem->>'price_cents')::INTEGER
    FROM jsonb_array_elements(p_service_data::jsonb) AS elem;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', v_booking_uuid,
    'slot_id', p_slot_id
  );
END;
$$;

COMMENT ON FUNCTION create_booking_atomically IS 'Atomically reserves slot and creates booking. Slot reservation expiry is 10 minutes.';

-- =============================================================================
-- 2. record_timing – INSERT only; no per-call DELETE
-- =============================================================================
-- Cleanup of old rows: run trim_metric_timings() periodically (e.g. cron every 5–15 min).

CREATE OR REPLACE FUNCTION record_timing(metric_name TEXT, duration_ms INTEGER)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  INSERT INTO metric_timings (metric, duration_ms)
  VALUES (metric_name, duration_ms);
END;
$$;

-- Optional: call from cron to keep metric_timings bounded (e.g. keep last 2000 per metric).
CREATE OR REPLACE FUNCTION trim_metric_timings(keep_per_metric INTEGER DEFAULT 2000)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  DELETE FROM metric_timings
  WHERE id IN (
    SELECT id FROM (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY metric ORDER BY recorded_at DESC) AS rn
      FROM metric_timings
    ) sub
    WHERE rn > keep_per_metric
  );
END;
$$;

COMMENT ON FUNCTION record_timing IS 'Record a timing sample. Use trim_metric_timings() in cron to prune old rows.';
COMMENT ON FUNCTION trim_metric_timings IS 'Cron: prune metric_timings to keep last keep_per_metric rows per metric.';
