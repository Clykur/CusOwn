-- Migration: Idempotent booking creation in a single transaction (no duplicate under same key).
-- New RPC reserves idempotency row with FOR UPDATE, creates booking, sets result_id and _in_progress in one tx.
-- Run after migration_booking_idempotency_and_atomic_reject.sql and migration_atomic_booking_creation.sql.

-- =============================================================================
-- create_booking_idempotent_reserve: lock key row, check snapshot, create booking, set result in one transaction.
-- Returns: status ('duplicate' | 'in_progress' | 'created'), response_snapshot (for duplicate), booking_id (for created).
-- Caller must then call set_idempotency_booking_result with full snapshot for 'created'.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.create_booking_idempotent_reserve(
  p_key TEXT,
  p_ttl_hours INTEGER,
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
RETURNS TABLE(status TEXT, response_snapshot JSONB, booking_id UUID)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_result_id UUID;
  v_snapshot JSONB;
  v_create_result JSONB;
  v_booking_uuid UUID;
  v_expires_at TIMESTAMP WITH TIME ZONE;
BEGIN
  IF p_key IS NULL OR trim(p_key) = '' OR length(p_key) > 512 THEN
    RAISE EXCEPTION 'idempotency key must be non-empty and at most 512 chars';
  END IF;

  v_expires_at := NOW() + (p_ttl_hours || ' hours')::INTERVAL;

  INSERT INTO public.idempotency_keys (key, resource_type, result_id, expires_at)
  VALUES (p_key, 'booking', NULL, v_expires_at)
  ON CONFLICT (key, resource_type) DO NOTHING;

  SELECT ik.result_id, ik.response_snapshot
  INTO v_result_id, v_snapshot
  FROM public.idempotency_keys ik
  WHERE ik.key = p_key AND ik.resource_type = 'booking'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_snapshot IS NOT NULL AND (v_snapshot->>'_in_progress') IS NULL THEN
    status := 'duplicate';
    response_snapshot := v_snapshot;
    booking_id := v_result_id;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_snapshot IS NOT NULL AND (v_snapshot->>'_in_progress') = 'true' THEN
    status := 'in_progress';
    response_snapshot := NULL;
    booking_id := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  UPDATE public.idempotency_keys
  SET response_snapshot = '{"_in_progress":true}'::jsonb
  WHERE key = p_key AND resource_type = 'booking';

  v_create_result := public.create_booking_atomically(
    p_business_id,
    p_slot_id,
    p_customer_name,
    p_customer_phone,
    p_booking_id,
    p_customer_user_id,
    p_total_duration_minutes,
    p_total_price_cents,
    p_services_count,
    p_service_data
  );

  IF NOT (v_create_result->>'success')::boolean THEN
    RAISE EXCEPTION 'Booking creation failed: %', COALESCE(v_create_result->>'error', 'Unknown error');
  END IF;

  v_booking_uuid := (v_create_result->>'booking_id')::uuid;

  UPDATE public.idempotency_keys
  SET result_id = v_booking_uuid
  WHERE key = p_key AND resource_type = 'booking';

  status := 'created';
  response_snapshot := NULL;
  booking_id := v_booking_uuid;
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.create_booking_idempotent_reserve IS 'Idempotent booking: lock key row, create booking, set result in one transaction. Prevents duplicate creation under same key. Caller stores full response_snapshot via set_idempotency_booking_result.';
