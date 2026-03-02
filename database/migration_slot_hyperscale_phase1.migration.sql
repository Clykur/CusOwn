-- Migration: Slot hyperscale Phase 1 — database hardening (no behavior change).
-- Adds composite indexes, partial index, and FOR UPDATE SKIP LOCKED in booking RPCs.
-- Partitioning: RANGE by date would require PK (id, date) and FK change on bookings(slot_id);
-- deferred to avoid schema/API break. Indexes below support partition-ready query patterns.

-- =============================================================================
-- 1. Composite and partial indexes (business_id-first for shard readiness)
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_slots_business_date_start
  ON slots (business_id, date, start_time);

CREATE INDEX IF NOT EXISTS idx_slots_status_reserved_until
  ON slots (status, reserved_until);

-- Partial index for reservation expiry (used by amortized cleanup and cron)
CREATE INDEX IF NOT EXISTS idx_slots_reserved_until_expired
  ON slots (reserved_until)
  WHERE status = 'reserved';

-- (business_id, date) and (business_id, date, status) may already exist; create if not
CREATE INDEX IF NOT EXISTS idx_slots_business_date
  ON slots (business_id, date);

CREATE INDEX IF NOT EXISTS idx_slots_business_date_status
  ON slots (business_id, date, status);

-- =============================================================================
-- 2. create_booking_atomically — FOR UPDATE SKIP LOCKED, business_id in WHERE
-- =============================================================================
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
    AND s.business_id = p_business_id
  FOR UPDATE OF s SKIP LOCKED;

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
    AND business_id = p_business_id
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

COMMENT ON FUNCTION create_booking_atomically IS 'Atomically reserves slot and creates booking. Uses FOR UPDATE SKIP LOCKED for concurrency.';

-- =============================================================================
-- 3. confirm_booking_atomically — slot lock with SKIP LOCKED
-- =============================================================================
CREATE OR REPLACE FUNCTION confirm_booking_atomically(
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
  FOR UPDATE SKIP LOCKED;

  IF v_slot_status IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Slot not found');
  END IF;

  IF v_slot_status = 'booked' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Slot already booked');
  END IF;

  IF v_slot_status NOT IN ('available', 'reserved') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid slot status', 'slot_status', v_slot_status);
  END IF;

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

COMMENT ON FUNCTION confirm_booking_atomically IS 'Atomically confirms booking and marks slot as booked. Uses FOR UPDATE SKIP LOCKED on slot.';

-- =============================================================================
-- 4. reject_booking_atomically — slot lock with SKIP LOCKED
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
  FOR UPDATE SKIP LOCKED;

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
    UPDATE bookings SET status = 'pending', updated_at = NOW() WHERE id = p_booking_id;
    RETURN jsonb_build_object('success', false, 'error', 'Slot update failed');
  END IF;

  RETURN jsonb_build_object('success', true, 'booking_id', p_booking_id, 'slot_id', v_slot_id);
END;
$$;

COMMENT ON FUNCTION public.reject_booking_atomically IS 'Atomically reject pending booking and release slot. Uses FOR UPDATE SKIP LOCKED on slot.';

-- =============================================================================
-- 5. undo_confirm_booking_atomically — lock slot with SKIP LOCKED before UPDATE
-- =============================================================================
-- (Replaces slot UPDATE with SELECT FOR UPDATE SKIP LOCKED then UPDATE.)
DROP FUNCTION IF EXISTS public.undo_confirm_booking_atomically(UUID, UUID);

CREATE OR REPLACE FUNCTION public.undo_confirm_booking_atomically(
  p_booking_id UUID,
  p_actor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking RECORD;
  v_business RECORD;
  v_actor_role TEXT;
  v_now TIMESTAMP WITH TIME ZONE := NOW();
  v_slot_status TEXT;
BEGIN
  SELECT * INTO v_booking
  FROM bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  SELECT user_type INTO v_actor_role
  FROM user_profiles
  WHERE id = p_actor_id;

  SELECT * INTO v_business
  FROM businesses
  WHERE id = v_booking.business_id;

  IF v_actor_role != 'owner' OR v_business.owner_user_id != p_actor_id THEN
    RAISE EXCEPTION 'Unauthorized: Only the business owner can perform this action';
  END IF;

  IF v_booking.undo_used_at IS NOT NULL THEN
    RAISE EXCEPTION 'Undo already used';
  END IF;

  IF v_booking.status != 'confirmed' THEN
    RAISE EXCEPTION 'Booking not in confirmed state';
  END IF;

  IF v_now > v_booking.updated_at + INTERVAL '5 minutes' THEN
    RAISE EXCEPTION 'Undo window expired';
  END IF;

  SELECT status INTO v_slot_status
  FROM slots
  WHERE id = v_booking.slot_id
  FOR UPDATE SKIP LOCKED;

  IF v_slot_status IS NULL OR v_slot_status != 'booked' THEN
    RAISE EXCEPTION 'Slot no longer available or already released';
  END IF;

  UPDATE slots
  SET status = 'available',
      reserved_until = NULL
  WHERE id = v_booking.slot_id
    AND status = 'booked';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Slot no longer available or already released';
  END IF;

  UPDATE bookings
  SET status = 'pending',
      undo_used_at = v_now,
      updated_at = v_now
  WHERE id = p_booking_id;

  INSERT INTO booking_transition_audit (
    booking_id, from_status, to_status, action_type, actor_id
  ) VALUES (
    p_booking_id, 'confirmed', 'pending', 'undo_confirm', p_actor_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', p_booking_id,
    'new_status', 'pending',
    'undo_used_at', v_now
  );
END;
$$;

COMMENT ON FUNCTION public.undo_confirm_booking_atomically IS 'Undo confirm: revert to pending and release slot. Uses FOR UPDATE SKIP LOCKED on slot.';

-- =============================================================================
-- 6. undo_reject_booking_atomically — slot lock with SKIP LOCKED
-- =============================================================================
DROP FUNCTION IF EXISTS public.undo_reject_booking_atomically(UUID, UUID);

CREATE OR REPLACE FUNCTION public.undo_reject_booking_atomically(
  p_booking_id UUID,
  p_actor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking RECORD;
  v_business RECORD;
  v_actor_role TEXT;
  v_slot_status TEXT;
  v_now TIMESTAMP WITH TIME ZONE := NOW();
BEGIN
  SELECT * INTO v_booking
  FROM bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  SELECT user_type INTO v_actor_role
  FROM user_profiles
  WHERE id = p_actor_id;

  SELECT * INTO v_business
  FROM businesses
  WHERE id = v_booking.business_id;

  IF v_actor_role != 'owner' OR v_business.owner_user_id != p_actor_id THEN
    RAISE EXCEPTION 'Unauthorized: Only the business owner can perform this action';
  END IF;

  IF v_booking.undo_used_at IS NOT NULL THEN
    RAISE EXCEPTION 'Undo already used';
  END IF;

  IF v_booking.status != 'rejected' THEN
    RAISE EXCEPTION 'Booking not in rejected state';
  END IF;

  IF v_now > v_booking.updated_at + INTERVAL '5 minutes' THEN
    RAISE EXCEPTION 'Undo window expired';
  END IF;

  SELECT status INTO v_slot_status
  FROM slots
  WHERE id = v_booking.slot_id
  FOR UPDATE SKIP LOCKED;

  IF v_slot_status != 'available' THEN
    RAISE EXCEPTION 'Slot no longer available';
  END IF;

  UPDATE bookings
  SET status = 'pending',
      undo_used_at = v_now,
      updated_at = v_now
  WHERE id = p_booking_id;

  INSERT INTO booking_transition_audit (
    booking_id, from_status, to_status, action_type, actor_id
  ) VALUES (
    p_booking_id, 'rejected', 'pending', 'undo_reject', p_actor_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', p_booking_id,
    'new_status', 'pending',
    'undo_used_at', v_now
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION public.undo_reject_booking_atomically IS 'Undo reject: revert to pending. Uses FOR UPDATE SKIP LOCKED on slot.';

-- =============================================================================
-- 7. confirm_booking_with_payment — slot lock with SKIP LOCKED
-- =============================================================================
CREATE OR REPLACE FUNCTION confirm_booking_with_payment(
  p_payment_id UUID,
  p_booking_id UUID,
  p_slot_id UUID,
  p_actor_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_payment_status TEXT;
  v_booking_status TEXT;
  v_slot_status TEXT;
  v_result JSONB;
BEGIN
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
  FOR UPDATE SKIP LOCKED;

  IF v_slot_status IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Slot not found');
  END IF;

  IF v_slot_status = 'booked' THEN
    UPDATE payments
    SET status = 'failed',
        failure_reason = 'Slot already booked',
        updated_at = NOW()
    WHERE id = p_payment_id;
    RETURN jsonb_build_object('success', false, 'error', 'Slot already booked');
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
  WHERE id = p_slot_id
    AND status IN ('available', 'reserved');

  IF NOT FOUND THEN
    UPDATE bookings SET status = 'pending', updated_at = NOW() WHERE id = p_booking_id;
    UPDATE payments
    SET status = 'failed',
        failure_reason = 'Slot booking failed',
        updated_at = NOW()
    WHERE id = p_payment_id;
    RETURN jsonb_build_object('success', false, 'error', 'Slot booking failed');
  END IF;

  INSERT INTO payment_audit_logs (
    payment_id, actor_id, actor_type, action, from_status, to_status, metadata
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

COMMENT ON FUNCTION confirm_booking_with_payment IS 'Confirm booking with payment; uses FOR UPDATE SKIP LOCKED on slot.';
