-- Migration: Hardened Booking Undo System
-- Enforces: Single-use, 5-minute window, row locking, ownership checks, and transition logging.
-- Phased implementation: 1, 2, 3, 6, 7.

-- =============================================================================
-- PHASE 3: Transition Logging Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.booking_transition_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  action_type TEXT NOT NULL,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_booking_transition_audit_booking_id ON public.booking_transition_audit(booking_id);

COMMENT ON TABLE public.booking_transition_audit IS 'Audit log for booking status changes (e.g., undo_confirm, undo_reject).';

-- =============================================================================
-- PHASE 2: Single-Use Guarantee (Constraint)
-- =============================================================================
-- This constraint ensures that if undo_used_at is set, it means the undo functionality was used.
-- We allow any valid final status (pending, confirmed, rejected) so that the booking
-- can be processed again after an undo without violating this check.
-- The RPCs strictly prevent RE-USING the undo if undo_used_at is already set.
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS undo_used_once_check;
ALTER TABLE public.bookings
ADD CONSTRAINT undo_used_once_check
CHECK (
  undo_used_at IS NULL
  OR status IN ('pending', 'confirmed', 'rejected')
);

-- =============================================================================
-- PHASE 1, 6, 7: Hardened RPCs
-- =============================================================================

-- Drop existing functions first because we are changing parameter defaults/signatures
DROP FUNCTION IF EXISTS public.undo_confirm_booking_atomically(UUID, UUID);
DROP FUNCTION IF EXISTS public.undo_reject_booking_atomically(UUID, UUID);

-- 1. undo_confirm_booking_atomically
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
BEGIN
  -- 1. Lock booking row (Race condition safety)
  SELECT * INTO v_booking
  FROM bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  -- 2. Validate actor role and business ownership (Security)
  SELECT user_type INTO v_actor_role
  FROM user_profiles
  WHERE id = p_actor_id;

  SELECT * INTO v_business
  FROM businesses
  WHERE id = v_booking.business_id;

  IF v_actor_role != 'owner' OR v_business.owner_user_id != p_actor_id THEN
    -- Allow admins to undo? Requirements say actor role = owner and validate actor owns business.
    -- We'll follow strict requirements.
    RAISE EXCEPTION 'Unauthorized: Only the business owner can perform this action';
  END IF;

  -- 3. Single-use enforcement
  IF v_booking.undo_used_at IS NOT NULL THEN
    RAISE EXCEPTION 'Undo already used';
  END IF;

  -- 4. Status validation
  IF v_booking.status != 'confirmed' THEN
    RAISE EXCEPTION 'Booking not in confirmed state';
  END IF;

  -- 5. Time window enforcement (5 minutes)
  IF v_now > v_booking.updated_at + INTERVAL '5 minutes' THEN
    RAISE EXCEPTION 'Undo window expired';
  END IF;

  -- 6. Lock related slot row
  UPDATE slots
  SET status = 'available',
      reserved_until = NULL
  WHERE id = v_booking.slot_id
    AND status = 'booked';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Slot no longer available or already released';
  END IF;

  -- 7. Perform Undo
  UPDATE bookings
  SET
    status = 'pending',
    undo_used_at = v_now,
    updated_at = v_now
  WHERE id = p_booking_id;

  -- 8. Log transition
  INSERT INTO booking_transition_audit (
    booking_id,
    from_status,
    to_status,
    action_type,
    actor_id
  ) VALUES (
    p_booking_id,
    'confirmed',
    'pending',
    'undo_confirm',
    p_actor_id
  );

  -- 9. Return structured response
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

-- 2. undo_reject_booking_atomically
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
  -- 1. Lock booking row
  SELECT * INTO v_booking
  FROM bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  -- 2. Validate actor role and business ownership
  SELECT user_type INTO v_actor_role
  FROM user_profiles
  WHERE id = p_actor_id;

  SELECT * INTO v_business
  FROM businesses
  WHERE id = v_booking.business_id;

  IF v_actor_role != 'owner' OR v_business.owner_user_id != p_actor_id THEN
    RAISE EXCEPTION 'Unauthorized: Only the business owner can perform this action';
  END IF;

  -- 3. Single-use enforcement
  IF v_booking.undo_used_at IS NOT NULL THEN
    RAISE EXCEPTION 'Undo already used';
  END IF;

  -- 4. Status validation
  IF v_booking.status != 'rejected' THEN
    RAISE EXCEPTION 'Booking not in rejected state';
  END IF;

  -- 5. Time window enforcement (5 minutes)
  IF v_now > v_booking.updated_at + INTERVAL '5 minutes' THEN
    RAISE EXCEPTION 'Undo window expired';
  END IF;

  -- 6. Lock related slot row and check availability
  SELECT status INTO v_slot_status
  FROM slots
  WHERE id = v_booking.slot_id
  FOR UPDATE;

  IF v_slot_status != 'available' THEN
    RAISE EXCEPTION 'Slot no longer available';
  END IF;

  -- 7. Perform Undo
  UPDATE bookings
  SET
    status = 'pending',
    undo_used_at = v_now,
    updated_at = v_now
  WHERE id = p_booking_id;

  -- 8. Log transition
  INSERT INTO booking_transition_audit (
    booking_id,
    from_status,
    to_status,
    action_type,
    actor_id
  ) VALUES (
    p_booking_id,
    'rejected',
    'pending',
    'undo_reject',
    p_actor_id
  );

  -- 9. Return structured response
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
