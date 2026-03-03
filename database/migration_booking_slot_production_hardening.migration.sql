-- Migration: Booking and slot production hardening.
-- Concurrency: unique one-confirmed-per-slot, overlap prevention, hold TTL.
-- Soft delete: block business delete if active bookings. Timezone: optional business TZ.
-- Indexes: support listing and integrity. No business logic intent change.

-- =============================================================================
-- 1. Unique constraint: at most one confirmed booking per slot (double-book protection)
-- =============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_one_confirmed_per_slot
  ON bookings (slot_id)
  WHERE status = 'confirmed';

-- =============================================================================
-- 2. Indexes for performance and integrity
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_bookings_customer_user_id
  ON bookings (customer_user_id)
  WHERE customer_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_slot_id_status
  ON bookings (slot_id, status);

CREATE INDEX IF NOT EXISTS idx_bookings_business_status_created
  ON bookings (business_id, status, created_at DESC);

-- =============================================================================
-- 3. Business timezone (optional): store for presentation-layer conversion; all stored timestamps remain UTC
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'businesses' AND column_name = 'timezone'
  ) THEN
    ALTER TABLE businesses ADD COLUMN timezone TEXT DEFAULT 'UTC';
    COMMENT ON COLUMN businesses.timezone IS 'IANA timezone for presentation; stored timestamps are UTC.';
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;

-- =============================================================================
-- 4. create_booking_atomically: add slot overlap check (reject overlapping pending/confirmed for same business)
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
  v_slot_date DATE;
  v_slot_start TIME;
  v_slot_end TIME;
  v_business_suspended BOOLEAN;
  v_reserved_until TIMESTAMP WITH TIME ZONE;
  v_booking_uuid UUID;
  v_reservation_expiry TIMESTAMP WITH TIME ZONE;
  v_slot_expiry_minutes CONSTANT INTEGER := 10;
BEGIN
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

  -- Overlap prevention: no other pending/confirmed booking with overlapping slot time (same business, same date)
  IF EXISTS (
    SELECT 1
    FROM bookings b2
    JOIN slots s2 ON b2.slot_id = s2.id
    WHERE b2.business_id = p_business_id
      AND b2.status IN ('pending', 'confirmed')
      AND b2.slot_id != p_slot_id
      AND s2.date = v_slot_date
      AND s2.start_time < v_slot_end
      AND s2.end_time > v_slot_start
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

COMMENT ON FUNCTION create_booking_atomically IS 'Atomically reserves slot and creates booking. Enforces one confirmed per slot, overlap check, FOR UPDATE SKIP LOCKED.';

-- =============================================================================
-- 5. Block business soft delete if active (pending or confirmed) bookings exist
-- =============================================================================
-- Wrap soft_delete_business in a guard: we add a helper and use it in the existing flow.
-- If soft_delete_business is in migration_deletion_compliance_dsa, we add a check there via new function.
CREATE OR REPLACE FUNCTION public.business_has_active_bookings(p_business_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM bookings
    WHERE business_id = p_business_id
      AND status IN ('pending', 'confirmed')
    LIMIT 1
  );
$$;

COMMENT ON FUNCTION public.business_has_active_bookings IS 'Returns true if business has any pending or confirmed booking (used to block soft delete).';

-- Block soft delete when active bookings exist via trigger (no change to soft_delete_business RPC).
CREATE OR REPLACE FUNCTION public.check_business_no_active_bookings_before_soft_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND (OLD.deleted_at IS NULL OR OLD.deleted_at IS DISTINCT FROM NEW.deleted_at) THEN
    IF public.business_has_active_bookings(NEW.id) THEN
      RAISE EXCEPTION 'Cannot soft-delete business: active (pending or confirmed) bookings exist';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Only create trigger if businesses has deleted_at (soft-delete migration may run in different order)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'businesses' AND column_name = 'deleted_at'
  ) THEN
    DROP TRIGGER IF EXISTS trg_business_soft_delete_active_bookings ON businesses;
    CREATE TRIGGER trg_business_soft_delete_active_bookings
      BEFORE UPDATE OF deleted_at ON businesses
      FOR EACH ROW
      EXECUTE FUNCTION public.check_business_no_active_bookings_before_soft_delete();
  END IF;
END $$;
