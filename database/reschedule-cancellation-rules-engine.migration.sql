-- Migration: Atomic reschedule + cancellation rules engine.
-- Adds: reschedule_booking RPC (lock both slots, validate, release old, update booking, audit);
--       cancel_booking_atomically with late_cancellation flag; no-show auto-mark RPC;
--       booking_lifecycle_audit table; business cancellation_window_minutes, max_reschedule_count;
--       booking reschedule_count, late_cancellation. Timezone-aware deadlines via business.timezone.
-- No change to booking/slot state machine intent.

-- =============================================================================
-- 1. booking_lifecycle_audit: full audit trail for reschedule/cancel/no_show
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.booking_lifecycle_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  old_slot_id UUID REFERENCES public.slots(id) ON DELETE SET NULL,
  new_slot_id UUID REFERENCES public.slots(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL CHECK (action_type IN (
    'reschedule', 'cancel', 'no_show', 'confirm', 'reject', 'expire'
  )),
  actor_type TEXT CHECK (actor_type IN ('customer', 'owner', 'system')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE public.booking_lifecycle_audit IS 'Audit trail: booking_id, old_slot, new_slot, action_type, timestamp. PII not stored.';

CREATE INDEX IF NOT EXISTS idx_booking_lifecycle_audit_booking_id
  ON public.booking_lifecycle_audit(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_lifecycle_audit_created_at
  ON public.booking_lifecycle_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_booking_lifecycle_audit_action_type
  ON public.booking_lifecycle_audit(action_type);

-- =============================================================================
-- 2. Businesses: cancellation_window_minutes, max_reschedule_count (nullable; use app default when null)
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'businesses' AND column_name = 'cancellation_window_minutes'
  ) THEN
    ALTER TABLE public.businesses ADD COLUMN cancellation_window_minutes INTEGER DEFAULT NULL;
    COMMENT ON COLUMN public.businesses.cancellation_window_minutes IS 'Minutes before slot start (in business timezone) after which cancellation is late. Null = use app default.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'businesses' AND column_name = 'max_reschedule_count'
  ) THEN
    ALTER TABLE public.businesses ADD COLUMN max_reschedule_count INTEGER DEFAULT NULL;
    COMMENT ON COLUMN public.businesses.max_reschedule_count IS 'Max reschedules allowed per booking. Null = use app default.';
  END IF;
END $$;

-- =============================================================================
-- 3. Bookings: reschedule_count, late_cancellation
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'reschedule_count'
  ) THEN
    ALTER TABLE public.bookings ADD COLUMN reschedule_count INTEGER NOT NULL DEFAULT 0;
    COMMENT ON COLUMN public.bookings.reschedule_count IS 'Number of times this booking has been rescheduled.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'late_cancellation'
  ) THEN
    ALTER TABLE public.bookings ADD COLUMN late_cancellation BOOLEAN NOT NULL DEFAULT false;
    COMMENT ON COLUMN public.bookings.late_cancellation IS 'True when cancelled within business cancellation_window_minutes of slot start (timezone-aware).';
  END IF;
END $$;

-- =============================================================================
-- 4. reschedule_booking RPC: lock both slots (consistent order), validate, release old, update booking, audit
-- =============================================================================
CREATE OR REPLACE FUNCTION public.reschedule_booking(
  p_booking_id UUID,
  p_new_slot_id UUID,
  p_rescheduled_by TEXT,
  p_reschedule_reason TEXT DEFAULT NULL,
  p_max_reschedule_count INTEGER DEFAULT 5
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_booking RECORD;
  v_old_slot_id UUID;
  v_business_id UUID;
  v_new_slot_status TEXT;
  v_new_slot_business_id UUID;
  v_new_date DATE;
  v_new_start TIME;
  v_new_end TIME;
  v_old_date DATE;
  v_old_start TIME;
  v_old_end TIME;
  v_max_count INTEGER;
BEGIN
  IF p_rescheduled_by IS NULL OR p_rescheduled_by NOT IN ('customer', 'owner') THEN
    RETURN jsonb_build_object('success', false, 'error', 'rescheduled_by must be customer or owner');
  END IF;

  -- Lock booking
  SELECT id, slot_id, business_id, status, no_show, reschedule_count
  INTO v_booking
  FROM bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking not found');
  END IF;

  IF v_booking.status NOT IN ('pending', 'confirmed') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only pending or confirmed bookings can be rescheduled', 'current_status', v_booking.status);
  END IF;

  IF COALESCE(v_booking.no_show, false) = true THEN
    RETURN jsonb_build_object('success', false, 'error', 'No-show bookings cannot be rescheduled');
  END IF;

  v_old_slot_id := v_booking.slot_id;
  v_business_id := v_booking.business_id;

  IF p_new_slot_id = v_old_slot_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'New slot must be different from current slot');
  END IF;

  -- Max reschedule: use business setting or param default
  SELECT COALESCE(b.max_reschedule_count, p_max_reschedule_count) INTO v_max_count
  FROM businesses b WHERE b.id = v_business_id;
  v_max_count := COALESCE(v_max_count, p_max_reschedule_count);
  IF v_booking.reschedule_count >= v_max_count THEN
    RETURN jsonb_build_object('success', false, 'error', 'Max reschedule count exceeded', 'reschedule_count', v_booking.reschedule_count);
  END IF;

  -- Lock both slots in consistent order (by id) to avoid deadlock
  IF v_old_slot_id < p_new_slot_id THEN
    PERFORM 1 FROM slots WHERE id = v_old_slot_id AND business_id = v_business_id FOR UPDATE;
    PERFORM 1 FROM slots WHERE id = p_new_slot_id AND business_id = v_business_id FOR UPDATE;
  ELSE
    PERFORM 1 FROM slots WHERE id = p_new_slot_id AND business_id = v_business_id FOR UPDATE;
    PERFORM 1 FROM slots WHERE id = v_old_slot_id AND business_id = v_business_id FOR UPDATE;
  END IF;

  -- New slot must exist and belong to same business
  SELECT s.status, s.business_id, s.date, s.start_time, s.end_time
  INTO v_new_slot_status, v_new_slot_business_id, v_new_date, v_new_start, v_new_end
  FROM slots s
  WHERE s.id = p_new_slot_id;

  IF v_new_slot_business_id IS NULL OR v_new_slot_business_id != v_business_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'New slot not found or does not belong to business');
  END IF;

  IF v_new_slot_status = 'booked' THEN
    RETURN jsonb_build_object('success', false, 'error', 'New slot is already booked');
  END IF;

  IF v_new_slot_status = 'reserved' THEN
    IF EXISTS (SELECT 1 FROM slots WHERE id = p_new_slot_id AND reserved_until IS NOT NULL AND reserved_until > NOW()) THEN
      RETURN jsonb_build_object('success', false, 'error', 'New slot is reserved');
    END IF;
  END IF;

  -- Overlap: no other pending/confirmed booking with overlapping time (same business, same date)
  IF EXISTS (
    SELECT 1
    FROM bookings b2
    JOIN slots s2 ON b2.slot_id = s2.id
    WHERE b2.business_id = v_business_id
      AND b2.status IN ('pending', 'confirmed')
      AND b2.id != p_booking_id
      AND b2.slot_id != p_new_slot_id
      AND s2.date = v_new_date
      AND s2.start_time < v_new_end
      AND s2.end_time > v_new_start
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'New slot overlaps with an existing booking');
  END IF;

  -- Get old slot times for audit
  SELECT date, start_time, end_time INTO v_old_date, v_old_start, v_old_end
  FROM slots WHERE id = v_old_slot_id;

  -- Release old slot
  UPDATE slots
  SET status = 'available', reserved_until = NULL
  WHERE id = v_old_slot_id;

  -- Take new slot (booked)
  UPDATE slots
  SET status = 'booked', reserved_until = NULL
  WHERE id = p_new_slot_id;

  -- Update booking
  UPDATE bookings
  SET slot_id = p_new_slot_id,
      reschedule_count = reschedule_count + 1,
      rescheduled_at = NOW(),
      rescheduled_by = p_rescheduled_by,
      reschedule_reason = p_reschedule_reason,
      updated_at = NOW()
  WHERE id = p_booking_id;

  -- Audit
  INSERT INTO booking_lifecycle_audit (booking_id, old_slot_id, new_slot_id, action_type, actor_type)
  VALUES (p_booking_id, v_old_slot_id, p_new_slot_id, 'reschedule', p_rescheduled_by);

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', p_booking_id,
    'old_slot_id', v_old_slot_id,
    'new_slot_id', p_new_slot_id
  );
END;
$$;

COMMENT ON FUNCTION public.reschedule_booking IS 'Atomically reschedule booking to new slot: lock both slots, validate, release old, update booking, audit. Enforces max reschedule count and no overlap.';

-- =============================================================================
-- 5. cancel_booking_atomically: release slot, set status/cancelled_by/late_cancellation from business timezone
-- =============================================================================
CREATE OR REPLACE FUNCTION public.cancel_booking_atomically(
  p_booking_id UUID,
  p_cancelled_by TEXT,
  p_cancellation_reason TEXT DEFAULT NULL,
  p_default_cancellation_window_minutes INTEGER DEFAULT 120
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_booking RECORD;
  v_slot_id UUID;
  v_window_minutes INTEGER;
  v_slot_start_ts TIMESTAMP WITH TIME ZONE;
  v_deadline_ts TIMESTAMP WITH TIME ZONE;
  v_tz TEXT;
  v_late BOOLEAN := false;
BEGIN
  IF p_cancelled_by IS NULL OR p_cancelled_by NOT IN ('customer', 'owner', 'system') THEN
    RETURN jsonb_build_object('success', false, 'error', 'cancelled_by must be customer, owner, or system');
  END IF;

  SELECT b.id, b.slot_id, b.status, b.business_id
  INTO v_booking
  FROM bookings b
  WHERE b.id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking not found');
  END IF;

  IF v_booking.status NOT IN ('pending', 'confirmed') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking cannot be cancelled from current state', 'current_status', v_booking.status);
  END IF;

  v_slot_id := v_booking.slot_id;

  -- Timezone-aware deadline: slot start in business timezone minus cancellation_window_minutes
  SELECT COALESCE(b.cancellation_window_minutes, p_default_cancellation_window_minutes),
         COALESCE(b.timezone, 'UTC')
  INTO v_window_minutes, v_tz
  FROM businesses b WHERE b.id = v_booking.business_id;

  v_window_minutes := COALESCE(v_window_minutes, p_default_cancellation_window_minutes);

  -- Slot start as timestamptz: (date + start_time) in business timezone then interpret as that zone
  SELECT (s.date + s.start_time) AT TIME ZONE v_tz AT TIME ZONE 'UTC'
  INTO v_slot_start_ts
  FROM slots s WHERE s.id = v_slot_id;

  v_deadline_ts := v_slot_start_ts - (v_window_minutes || ' minutes')::INTERVAL;
  IF NOW() < v_deadline_ts THEN
    v_late := false;
  ELSE
    v_late := true;
  END IF;

  -- Release slot
  UPDATE slots SET status = 'available', reserved_until = NULL WHERE id = v_slot_id;

  -- Update booking
  UPDATE bookings
  SET status = 'cancelled',
      cancelled_by = p_cancelled_by,
      cancellation_reason = p_cancellation_reason,
      cancelled_at = NOW(),
      late_cancellation = v_late,
      updated_at = NOW()
  WHERE id = p_booking_id;

  INSERT INTO booking_lifecycle_audit (booking_id, old_slot_id, new_slot_id, action_type, actor_type)
  VALUES (p_booking_id, v_slot_id, NULL, 'cancel', p_cancelled_by);

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', p_booking_id,
    'slot_id', v_slot_id,
    'late_cancellation', v_late
  );
END;
$$;

COMMENT ON FUNCTION public.cancel_booking_atomically IS 'Atomically cancel booking and release slot. Sets late_cancellation using business.timezone and cancellation_window_minutes.';

-- =============================================================================
-- 6. mark_no_show_after_slot_end: slot end in UTC using business timezone; mark after X minutes past
-- =============================================================================
CREATE OR REPLACE FUNCTION public.mark_no_show_after_slot_end(
  p_minutes_after_slot_end INTEGER DEFAULT 30,
  p_max_count INTEGER DEFAULT 100
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_row RECORD;
  v_count INTEGER := 0;
  v_cutoff TIMESTAMP WITH TIME ZONE;
BEGIN
  v_cutoff := NOW() - (p_minutes_after_slot_end || ' minutes')::INTERVAL;

  FOR v_row IN
    SELECT b.id AS booking_id, b.slot_id, b.business_id,
           ((s.date + s.end_time) AT TIME ZONE COALESCE(biz.timezone, 'UTC')) AT TIME ZONE 'UTC' AS slot_end_utc
    FROM bookings b
    JOIN slots s ON s.id = b.slot_id
    JOIN businesses biz ON biz.id = b.business_id
    WHERE b.status = 'confirmed'
      AND COALESCE(b.no_show, false) = false
      AND ((s.date + s.end_time) AT TIME ZONE COALESCE(biz.timezone, 'UTC')) AT TIME ZONE 'UTC' <= v_cutoff
    LIMIT p_max_count
    FOR UPDATE OF b SKIP LOCKED
  LOOP
    UPDATE bookings
    SET no_show = true,
        no_show_marked_at = NOW(),
        no_show_marked_by = 'system',
        updated_at = NOW()
    WHERE id = v_row.booking_id;

    INSERT INTO booking_lifecycle_audit (booking_id, old_slot_id, new_slot_id, action_type, actor_type)
    VALUES (v_row.booking_id, v_row.slot_id, NULL, 'no_show', 'system');

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'marked_count', v_count);
END;
$$;

COMMENT ON FUNCTION public.mark_no_show_after_slot_end IS 'Mark confirmed bookings as no-show when slot end (business timezone) is more than p_minutes_after_slot_end ago. Call from cron.';

-- =============================================================================
-- 7. Indexes for slot lookups (reschedule and availability)
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_slots_business_id_date_start_end
  ON public.slots(business_id, date, start_time, end_time);

CREATE INDEX IF NOT EXISTS idx_bookings_reschedule_count
  ON public.bookings(reschedule_count)
  WHERE status IN ('pending', 'confirmed');

CREATE INDEX IF NOT EXISTS idx_bookings_late_cancellation
  ON public.bookings(late_cancellation)
  WHERE late_cancellation = true;
