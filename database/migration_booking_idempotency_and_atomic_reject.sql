-- Migration: Booking idempotency (response snapshot) + atomic reject
-- 1. idempotency_keys.response_snapshot for storing/returning duplicate response.
-- 2. reject_booking_atomically: single transaction updates booking + slot.
-- Run after migration_idempotency_and_business_security.sql and migration_booking_state_machine.sql.

-- =============================================================================
-- PART 1: response_snapshot on idempotency_keys
-- =============================================================================
ALTER TABLE public.idempotency_keys
  ADD COLUMN IF NOT EXISTS response_snapshot JSONB;

COMMENT ON COLUMN public.idempotency_keys.response_snapshot IS 'Stored response for duplicate key; used by booking create.';

-- =============================================================================
-- PART 2: Get idempotency result for booking (returns result_id + response_snapshot if key exists and not expired)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_idempotency_booking(p_key TEXT)
RETURNS TABLE(result_id UUID, response_snapshot JSONB)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF p_key IS NULL OR trim(p_key) = '' THEN
    RAISE EXCEPTION 'idempotency key must be non-empty';
  END IF;

  RETURN QUERY
  SELECT ik.result_id, ik.response_snapshot
  FROM public.idempotency_keys ik
  WHERE ik.key = p_key
    AND ik.resource_type = 'booking'
    AND ik.expires_at > NOW();
END;
$$;

COMMENT ON FUNCTION public.get_idempotency_booking IS 'Returns stored result for booking idempotency key if not expired.';

-- =============================================================================
-- PART 3: Set idempotency result for booking (after successful create)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.set_idempotency_booking_result(
  p_key TEXT,
  p_result_id UUID,
  p_response_snapshot JSONB
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.idempotency_keys
  SET result_id = p_result_id,
      response_snapshot = p_response_snapshot
  WHERE key = p_key
    AND resource_type = 'booking'
    AND expires_at > NOW();
END;
$$;

COMMENT ON FUNCTION public.set_idempotency_booking_result IS 'Store booking result and response snapshot for idempotent duplicate return.';

-- =============================================================================
-- PART 4: Reserve idempotency key for booking (get_or_set with resource_type booking)
-- =============================================================================
-- Uses existing get_or_set_idempotency(key, 'booking', ttl). Caller then creates booking and calls set_idempotency_booking_result.

-- =============================================================================
-- PART 5: reject_booking_atomically (single transaction: booking -> rejected, slot -> available)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.reject_booking_atomically(
  p_booking_id UUID,
  p_actor_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_booking_status TEXT;
  v_slot_id UUID;
  v_slot_status TEXT;
BEGIN
  SELECT status, slot_id
  INTO v_booking_status, v_slot_id
  FROM bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF v_booking_status IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking not found');
  END IF;

  IF v_booking_status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking not in pending state', 'current_status', v_booking_status);
  END IF;

  SELECT status INTO v_slot_status
  FROM slots
  WHERE id = v_slot_id
  FOR UPDATE;

  IF v_slot_status IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Slot not found');
  END IF;

  UPDATE bookings
  SET status = 'rejected',
      updated_at = NOW()
  WHERE id = p_booking_id
    AND status = 'pending';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking update failed');
  END IF;

  UPDATE slots
  SET status = 'available',
      reserved_until = NULL
  WHERE id = v_slot_id;

  IF NOT FOUND THEN
    -- Rollback booking (restore pending)
    UPDATE bookings SET status = 'pending', updated_at = NOW() WHERE id = p_booking_id;
    RETURN jsonb_build_object('success', false, 'error', 'Slot update failed');
  END IF;

  RETURN jsonb_build_object('success', true, 'booking_id', p_booking_id, 'slot_id', v_slot_id);
END;
$$;

COMMENT ON FUNCTION public.reject_booking_atomically IS 'Atomically reject pending booking and release slot in one transaction.';
