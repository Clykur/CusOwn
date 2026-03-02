CREATE OR REPLACE FUNCTION confirm_booking_atomically(
  p_booking_id UUID,
  p_actor_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_booking_status TEXT;
  v_slot_id UUID;
  v_slot_status TEXT;
  v_actor_type TEXT;
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

  SELECT status
  INTO v_slot_status
  FROM slots
  WHERE id = v_slot_id
  FOR UPDATE;

  IF v_slot_status IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Slot not found');
  END IF;

  IF v_slot_status = 'booked' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Slot already booked');
  END IF;

  IF v_slot_status NOT IN ('available', 'reserved') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid slot status', 'slot_status', v_slot_status);
  END IF;

  -- Check for other confirmed bookings for this slot (DB invariant safety)
  IF EXISTS (
    SELECT 1 FROM bookings 
    WHERE slot_id = v_slot_id 
      AND status = 'confirmed' 
      AND id != p_booking_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Another booking for this slot is already confirmed');
  END IF;

  IF p_actor_id IS NOT NULL THEN
    SELECT user_type INTO v_actor_type
    FROM user_profiles
    WHERE id = p_actor_id;
  END IF;

  UPDATE bookings
  SET status = 'confirmed',
      updated_at = NOW()
  WHERE id = p_booking_id
    AND status = 'pending';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking confirmation failed');
  END IF;

  UPDATE slots
  SET status = 'booked',
      reserved_until = NULL
  WHERE id = v_slot_id
    AND status IN ('available', 'reserved');

  IF NOT FOUND THEN
    UPDATE bookings
    SET status = 'pending',
        updated_at = NOW()
    WHERE id = p_booking_id;

    RETURN jsonb_build_object('success', false, 'error', 'Slot booking failed');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', p_booking_id,
    'slot_id', v_slot_id
  );
END;
$$;

COMMENT ON FUNCTION confirm_booking_atomically IS 'Atomically confirms booking and marks slot as booked. Prevents booking confirmation without slot booking.';
