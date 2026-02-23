-- Migration: Atomic RPCs for undoing accept and reject (revert to pending).
-- Time window is enforced in application layer; RPC only enforces status and slot consistency.
-- Safe to run once.

-- =============================================================================
-- undo_confirm_booking_atomically: confirmed -> pending, slot -> available
-- =============================================================================
CREATE OR REPLACE FUNCTION public.undo_confirm_booking_atomically(
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
BEGIN
  SELECT status, slot_id
  INTO v_booking_status, v_slot_id
  FROM bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF v_booking_status IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking not found');
  END IF;

  IF v_booking_status != 'confirmed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking not in confirmed state', 'current_status', v_booking_status);
  END IF;

  UPDATE bookings
  SET status = 'pending',
      updated_at = NOW(),
      undo_used_at = COALESCE(undo_used_at, NOW())
  WHERE id = p_booking_id
    AND status = 'confirmed';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking update failed');
  END IF;

  UPDATE slots
  SET status = 'available',
      reserved_until = NULL
  WHERE id = v_slot_id
    AND status = 'booked';

  IF NOT FOUND THEN
    UPDATE bookings SET status = 'confirmed', updated_at = NOW() WHERE id = p_booking_id;
    RETURN jsonb_build_object('success', false, 'error', 'Slot update failed');
  END IF;

  RETURN jsonb_build_object('success', true, 'booking_id', p_booking_id, 'slot_id', v_slot_id);
END;
$$;

COMMENT ON FUNCTION public.undo_confirm_booking_atomically(UUID, UUID) IS 'Revert confirmed booking to pending and release slot. Call only within undo window.';

-- =============================================================================
-- undo_reject_booking_atomically: rejected -> pending (slot must still be available)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.undo_reject_booking_atomically(
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

  IF v_booking_status != 'rejected' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking not in rejected state', 'current_status', v_booking_status);
  END IF;

  SELECT status INTO v_slot_status
  FROM slots
  WHERE id = v_slot_id
  FOR UPDATE;

  IF v_slot_status IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Slot not found');
  END IF;

  IF v_slot_status != 'available' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Slot no longer available');
  END IF;

  UPDATE bookings
  SET status = 'pending',
      updated_at = NOW(),
      undo_used_at = COALESCE(undo_used_at, NOW())
  WHERE id = p_booking_id
    AND status = 'rejected';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking update failed');
  END IF;

  RETURN jsonb_build_object('success', true, 'booking_id', p_booking_id, 'slot_id', v_slot_id);
END;
$$;

COMMENT ON FUNCTION public.undo_reject_booking_atomically(UUID, UUID) IS 'Revert rejected booking to pending. Allowed only if slot is still available. Call only within undo window.';
