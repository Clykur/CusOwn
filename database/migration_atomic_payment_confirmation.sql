CREATE OR REPLACE FUNCTION confirm_booking_with_payment(
  p_payment_id UUID,
  p_booking_id UUID,
  p_slot_id UUID,
  p_actor_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_payment_status TEXT;
  v_booking_status TEXT;
  v_slot_status TEXT;
  v_result JSONB;
BEGIN
  -- Lock payment, booking, and slot for update (pessimistic locking)
  SELECT status INTO v_payment_status
  FROM payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF v_payment_status IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment not found');
  END IF;

  IF v_payment_status != 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment not completed', 'status', v_payment_status);
  END IF;

  SELECT status INTO v_booking_status
  FROM bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF v_booking_status IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking not found');
  END IF;

  IF v_booking_status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking not in pending state', 'status', v_booking_status);
  END IF;

  SELECT status INTO v_slot_status
  FROM slots
  WHERE id = p_slot_id
  FOR UPDATE;

  IF v_slot_status IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Slot not found');
  END IF;

  IF v_slot_status = 'booked' THEN
    -- Mark payment as failed if slot already booked
    UPDATE payments
    SET status = 'failed',
        failure_reason = 'Slot already booked',
        updated_at = NOW()
    WHERE id = p_payment_id;

    RETURN jsonb_build_object('success', false, 'error', 'Slot already booked');
  END IF;

  -- Atomic updates: booking confirmation + slot booking
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
      reserved_until = NULL,
      updated_at = NOW()
  WHERE id = p_slot_id
    AND status IN ('available', 'reserved');

  IF NOT FOUND THEN
    -- Rollback booking confirmation
    UPDATE bookings
    SET status = 'pending',
        updated_at = NOW()
    WHERE id = p_booking_id;

    UPDATE payments
    SET status = 'failed',
        failure_reason = 'Slot booking failed',
        updated_at = NOW()
    WHERE id = p_payment_id;

    RETURN jsonb_build_object('success', false, 'error', 'Slot booking failed');
  END IF;

  -- Log audit entry
  INSERT INTO payment_audit_logs (
    payment_id,
    actor_id,
    actor_type,
    action,
    from_status,
    to_status,
    metadata
  ) VALUES (
    p_payment_id,
    p_actor_id,
    COALESCE((SELECT user_type FROM user_profiles WHERE id = p_actor_id), 'system'),
    'booking_confirmed',
    'pending',
    'confirmed',
    jsonb_build_object('booking_id', p_booking_id, 'slot_id', p_slot_id)
  );

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', p_booking_id,
    'slot_id', p_slot_id,
    'payment_id', p_payment_id
  );
END;
$$;

COMMENT ON FUNCTION confirm_booking_with_payment IS 'Atomically confirms booking and marks slot as booked after payment verification. Returns JSONB with success status.';
