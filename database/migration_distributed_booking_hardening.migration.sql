-- Migration: Distributed-system hardening for booking engine.
-- Idempotency on bookings table, overlap ignores expired holds, cron lock, expired-hold cleanup, indexes, business version.
-- No business intent change.
--
-- Reserved-slot orphans: Crash mid-transaction → Postgres rollback releases slot. Crash after commit, before response →
-- idempotency key retry returns same booking; no orphan. Safe.

-- =============================================================================
-- 1. Bookings: idempotency_key column + UNIQUE (distributed idempotency)
-- =============================================================================
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_idempotency_key_format;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_idempotency_key_format
  CHECK (idempotency_key IS NULL OR (length(trim(idempotency_key)) >= 1 AND length(idempotency_key) <= 512));

CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_idempotency_key
  ON public.bookings (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

COMMENT ON COLUMN public.bookings.idempotency_key IS 'Idempotency: same key across retries returns same booking. Enforced UNIQUE for distributed safety.';

-- =============================================================================
-- 2. Indexes for overlap/cleanup and idempotency lookup
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_slots_status_reserved_until
  ON public.slots (status, reserved_until)
  WHERE status = 'reserved' AND reserved_until IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_business_status
  ON public.bookings (business_id, status)
  WHERE status IN ('pending', 'confirmed');

-- =============================================================================
-- 3. create_booking_atomically: accept idempotency_key; return existing if key exists; overlap ignores expired holds
-- =============================================================================
-- Drop the 10-parameter overload so the 11-parameter version is the only one (avoids 42725: function name not unique).
DROP FUNCTION IF EXISTS public.create_booking_atomically(UUID, UUID, TEXT, TEXT, TEXT, UUID, INTEGER, INTEGER, INTEGER, JSONB);

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
  p_service_data JSONB DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_slot_status TEXT;
  v_slot_business_id UUID;
  v_slot_date DATE;
  v_slot_start TIME;
  v_slot_end TIME;
  v_business_suspended BOOLEAN;
  v_reserved_until TIMESTAMP WITH TIME ZONE;
  v_booking_uuid UUID;
  v_slot_id_ret UUID;
  v_reservation_expiry TIMESTAMP WITH TIME ZONE;
  v_slot_expiry_minutes CONSTANT INTEGER := 10;
BEGIN
  -- Distributed idempotency: if key provided and booking already exists, return it
  IF p_idempotency_key IS NOT NULL AND length(trim(p_idempotency_key)) > 0 THEN
    SELECT id, slot_id INTO v_booking_uuid, v_slot_id_ret
    FROM bookings
    WHERE idempotency_key = p_idempotency_key
    FOR UPDATE;
    IF FOUND THEN
      RETURN jsonb_build_object('success', true, 'booking_id', v_booking_uuid, 'slot_id', v_slot_id_ret, 'idempotent', true);
    END IF;
  END IF;

  SELECT s.status, s.business_id, s.date, s.start_time, s.end_time, b.suspended, s.reserved_until
  INTO v_slot_status, v_slot_business_id, v_slot_date, v_slot_start, v_slot_end, v_business_suspended, v_reserved_until
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

  -- Overlap: only non-expired holds (confirmed, or pending with slot.reserved_until > NOW())
  IF EXISTS (
    SELECT 1
    FROM bookings b2
    JOIN slots s2 ON b2.slot_id = s2.id
    WHERE b2.business_id = p_business_id
      AND b2.slot_id != p_slot_id
      AND s2.date = v_slot_date
      AND s2.start_time < v_slot_end
      AND s2.end_time > v_slot_start
      AND (
        b2.status = 'confirmed'
        OR (b2.status = 'pending' AND s2.reserved_until IS NOT NULL AND s2.reserved_until > NOW())
      )
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Slot overlaps with an existing booking');
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
    services_count,
    idempotency_key
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
    p_services_count,
    p_idempotency_key
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

COMMENT ON FUNCTION create_booking_atomically IS 'Atomic booking creation. Pure DB only: no external API calls, no blocking I/O. Target <100ms. Supports idempotency_key for distributed retries; overlap ignores expired holds.';

-- =============================================================================
-- 4. create_booking_idempotent_reserve: pass idempotency key into create_booking_atomically
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
    p_service_data,
    p_idempotency_key := p_key
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

-- =============================================================================
-- 5. Expired hold cleanup: cancel pending bookings whose slot.reserved_until < NOW(), release slot
-- =============================================================================
CREATE OR REPLACE FUNCTION public.expire_pending_bookings_where_hold_expired(p_max_count INTEGER DEFAULT 500)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_booking RECORD;
  v_count INTEGER := 0;
  v_booking_ids UUID[] := '{}';
BEGIN
  FOR v_booking IN
    SELECT b.id, b.slot_id
    FROM bookings b
    JOIN slots s ON s.id = b.slot_id
    WHERE b.status = 'pending'
      AND s.status = 'reserved'
      AND s.reserved_until IS NOT NULL
      AND s.reserved_until < NOW()
    ORDER BY s.reserved_until ASC
    LIMIT p_max_count
    FOR UPDATE OF b
  LOOP
    UPDATE bookings
    SET status = 'cancelled',
        cancelled_by = 'system',
        cancelled_at = NOW(),
        updated_at = NOW()
    WHERE id = v_booking.id AND status = 'pending';

    IF FOUND THEN
      v_count := v_count + 1;
      v_booking_ids := array_append(v_booking_ids, v_booking.id);

      UPDATE slots
      SET status = 'available',
          reserved_until = NULL,
          updated_at = NOW()
      WHERE id = v_booking.slot_id AND status = 'reserved';
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'expired_count', v_count, 'booking_ids', to_jsonb(v_booking_ids));
END;
$$;

COMMENT ON FUNCTION public.expire_pending_bookings_where_hold_expired IS 'Cancel pending bookings whose slot hold expired (reserved_until < NOW()) and release slots. Idempotent.';

-- =============================================================================
-- 6. Distributed cron lock: table-based lock with TTL (works across instances)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.cron_locks (
  name TEXT PRIMARY KEY,
  acquired_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

COMMENT ON TABLE public.cron_locks IS 'Distributed cron lock: acquire by name; expires_at allows stale release.';

CREATE OR REPLACE FUNCTION public.try_acquire_cron_lock(p_name TEXT, p_ttl_seconds INTEGER DEFAULT 300)
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_expires TIMESTAMP WITH TIME ZONE := NOW() + (p_ttl_seconds || ' seconds')::INTERVAL;
  v_name TEXT;
BEGIN
  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RETURN FALSE;
  END IF;
  INSERT INTO public.cron_locks (name, acquired_at, expires_at)
  VALUES (trim(p_name), NOW(), v_expires)
  ON CONFLICT (name) DO UPDATE
  SET acquired_at = NOW(),
      expires_at = v_expires
  WHERE public.cron_locks.expires_at < NOW()
  RETURNING name INTO v_name;
  RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION public.try_acquire_cron_lock IS 'Acquire distributed cron lock by name. Returns true if acquired, false if held by another. TTL prevents stuck locks.';

CREATE OR REPLACE FUNCTION public.try_acquire_slot_generation_lock()
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN public.try_acquire_cron_lock('slot_generation', 600);
END;
$$;

COMMENT ON FUNCTION public.try_acquire_slot_generation_lock IS 'Distributed cron: acquire slot_generation lock (10 min TTL). Only one instance proceeds. Call refresh_slot_generation_lock periodically if run may exceed TTL.';

-- Refresh lock: only the current holder (expires_at > NOW()) can extend. Use while long-running work runs so TTL does not expire mid-run.
CREATE OR REPLACE FUNCTION public.refresh_cron_lock(p_name TEXT, p_ttl_seconds INTEGER DEFAULT 600)
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_rows INTEGER;
BEGIN
  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RETURN FALSE;
  END IF;
  UPDATE public.cron_locks
  SET expires_at = NOW() + (p_ttl_seconds || ' seconds')::INTERVAL
  WHERE name = trim(p_name) AND expires_at > NOW();
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;

COMMENT ON FUNCTION public.refresh_cron_lock IS 'Extend lock TTL. Only succeeds if caller still holds lock (expires_at > NOW()). Call periodically during long runs.';

CREATE OR REPLACE FUNCTION public.refresh_slot_generation_lock()
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN public.refresh_cron_lock('slot_generation', 600);
END;
$$;

COMMENT ON FUNCTION public.refresh_slot_generation_lock IS 'Extend slot_generation lock by 10 min. Call every 1–2 min while generating slots to avoid duplicate run if execution exceeds TTL.';

-- =============================================================================
-- 7. Businesses: optimistic locking version column + update RPC
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'businesses' AND column_name = 'version'
  ) THEN
    ALTER TABLE public.businesses ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
    COMMENT ON COLUMN public.businesses.version IS 'Optimistic lock: increment on update; WHERE version = current for conflict detection.';
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.update_business_with_version(
  p_id UUID,
  p_version INTEGER,
  p_updates JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_rows INTEGER;
BEGIN
  IF p_id IS NULL OR p_version IS NULL OR p_updates IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Missing id, version, or updates');
  END IF;
  UPDATE public.businesses
  SET
    opening_time = COALESCE((p_updates->>'opening_time')::TIME, opening_time),
    closing_time = COALESCE((p_updates->>'closing_time')::TIME, closing_time),
    slot_duration = COALESCE((p_updates->>'slot_duration')::INTEGER, slot_duration),
    salon_name = COALESCE(p_updates->>'salon_name', salon_name),
    updated_at = NOW(),
    version = version + 1
  WHERE id = p_id AND version = p_version;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Conflict: business was updated by another request');
  END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;

COMMENT ON FUNCTION public.update_business_with_version IS 'Optimistic lock: update business only when version matches; returns conflict error if 0 rows updated.';

-- =============================================================================
-- 8. Slot regeneration reconciliation: delete only future unbooked slots (never slots with confirmed bookings)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.delete_future_unbooked_slots(p_business_id UUID, p_from_date DATE DEFAULT CURRENT_DATE)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  WITH to_delete AS (
    SELECT s.id
    FROM slots s
    WHERE s.business_id = p_business_id
      AND s.date >= p_from_date
      AND s.status IN ('available', 'reserved')
      AND NOT EXISTS (
        SELECT 1 FROM bookings b
        WHERE b.slot_id = s.id AND b.status = 'confirmed'
      )
  )
  DELETE FROM slots WHERE id IN (SELECT id FROM to_delete);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'deleted_count', v_deleted);
END;
$$;

COMMENT ON FUNCTION public.delete_future_unbooked_slots IS 'Reconciliation: delete future available/reserved slots only; never deletes slots with confirmed bookings. Call before regenerating slots when business hours change.';
