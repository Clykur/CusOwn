-- Phase 1: Transactional expire pending bookings + DB invariant (one confirmed booking per slot).
-- Safe to run multiple times (idempotent).
-- Requires: bookings (id, status, slot_id, created_at, cancelled_by, cancelled_at), slots (id, status, reserved_until).

-- 1. RPC: Expire pending bookings older than p_expiry_hours in a single transaction.
--    Updates bookings to cancelled (system) and releases corresponding slots.
CREATE OR REPLACE FUNCTION expire_pending_bookings_atomically(p_expiry_hours INTEGER DEFAULT 24)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_cutoff TIMESTAMP WITH TIME ZONE;
  v_booking RECORD;
  v_booking_ids UUID[] := '{}';
  v_count INTEGER := 0;
BEGIN
  IF p_expiry_hours IS NULL OR p_expiry_hours < 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid expiry hours', 'expired_count', 0, 'booking_ids', '[]'::jsonb);
  END IF;

  v_cutoff := NOW() - (p_expiry_hours || ' hours')::INTERVAL;

  -- Lock and select pending bookings older than cutoff
  FOR v_booking IN
    SELECT b.id, b.slot_id
    FROM bookings b
    WHERE b.status = 'pending'
      AND b.created_at < v_cutoff
    FOR UPDATE OF b
  LOOP
    -- Update this booking to cancelled (system)
    UPDATE bookings
    SET status = 'cancelled',
        cancelled_by = 'system',
        cancelled_at = NOW(),
        updated_at = NOW()
    WHERE id = v_booking.id
      AND status = 'pending';

    IF FOUND THEN
      v_count := v_count + 1;
      v_booking_ids := array_append(v_booking_ids, v_booking.id);

      -- Release the slot
      UPDATE slots
      SET status = 'available',
          reserved_until = NULL,
          updated_at = NOW()
      WHERE id = v_booking.slot_id
        AND status = 'reserved';
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'expired_count', v_count,
    'booking_ids', to_jsonb(v_booking_ids)
  );
END;
$$;

COMMENT ON FUNCTION expire_pending_bookings_atomically IS 'Atomically expire pending bookings older than p_expiry_hours and release their slots. Single transaction. Idempotent when run multiple times.';

-- 2. DB invariant: At most one confirmed booking per slot (prevents double-confirm at DB level).
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_one_confirmed_per_slot
  ON bookings (slot_id)
  WHERE status = 'confirmed';

COMMENT ON INDEX idx_bookings_one_confirmed_per_slot IS 'Phase 1: Ensures at most one confirmed booking per slot.';
