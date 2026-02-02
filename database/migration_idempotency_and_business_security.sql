-- Migration: Idempotency hardening + business-level security
-- 1. Idempotency: dedicated table, payments CHECK/index, get-or-set helper.
-- 2. Business security: FORCE RLS, status transition triggers, table/column comments.
-- Safe to run once. Idempotent where possible.
-- Run after migration_supabase_linter_remediation.sql and migration_uuid_v7.sql.

-- =============================================================================
-- PART 1: Idempotency – table and helper
-- =============================================================================

-- Store idempotency keys with result reference and TTL (e.g. 24h). One result per key per resource type.
CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  key TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  result_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  CONSTRAINT idempotency_keys_pkey PRIMARY KEY (key, resource_type),
  CONSTRAINT idempotency_keys_key_nonempty CHECK (length(trim(key)) >= 1),
  CONSTRAINT idempotency_keys_key_maxlen CHECK (length(key) <= 512),
  CONSTRAINT idempotency_keys_resource_type_nonempty CHECK (length(trim(resource_type)) >= 1)
);

COMMENT ON TABLE public.idempotency_keys IS 'Idempotency: one result per (key, resource_type). Expires_at for cleanup. Application uses get_or_set_idempotency() or checks then inserts.';

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires_at ON public.idempotency_keys (expires_at);

-- Optional: enable RLS so only service role can read/write (no policies = deny anon/authenticated)
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

-- Get existing result_id if key exists and not expired; otherwise reserve key and return NULL (caller stores result_id).
CREATE OR REPLACE FUNCTION public.get_or_set_idempotency(
  p_key TEXT,
  p_resource_type TEXT,
  p_ttl_hours INTEGER DEFAULT 24
)
RETURNS UUID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_expires_at TIMESTAMP WITH TIME ZONE;
  v_existing RECORD;
BEGIN
  IF p_key IS NULL OR trim(p_key) = '' OR p_resource_type IS NULL OR trim(p_resource_type) = '' THEN
    RAISE EXCEPTION 'idempotency key and resource_type must be non-empty';
  END IF;

  v_expires_at := NOW() + (p_ttl_hours || ' hours')::INTERVAL;

  INSERT INTO public.idempotency_keys (key, resource_type, result_id, expires_at)
  VALUES (p_key, p_resource_type, NULL, v_expires_at)
  ON CONFLICT (key, resource_type) DO NOTHING;

  SELECT result_id, expires_at INTO v_existing
  FROM public.idempotency_keys
  WHERE idempotency_keys.key = p_key
    AND idempotency_keys.resource_type = p_resource_type
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_existing.expires_at > NOW() THEN
    RETURN v_existing.result_id;
  END IF;

  UPDATE public.idempotency_keys
  SET result_id = NULL, created_at = NOW(), expires_at = v_expires_at
  WHERE idempotency_keys.key = p_key AND idempotency_keys.resource_type = p_resource_type;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.get_or_set_idempotency IS 'Idempotency: returns existing result_id if key exists and not expired; else reserves key and returns NULL. Caller then performs operation and updates result_id.';

-- Optional: function to set result after successful operation
CREATE OR REPLACE FUNCTION public.set_idempotency_result(
  p_key TEXT,
  p_resource_type TEXT,
  p_result_id UUID
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.idempotency_keys
  SET result_id = p_result_id
  WHERE idempotency_keys.key = p_key
    AND idempotency_keys.resource_type = p_resource_type
    AND idempotency_keys.expires_at > NOW();
END;
$$;

COMMENT ON FUNCTION public.set_idempotency_result IS 'Call after successful operation to store result_id for the idempotency key.';

-- Prune expired idempotency keys (call from cron or periodically)
CREATE OR REPLACE FUNCTION public.prune_expired_idempotency_keys()
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  WITH d AS (DELETE FROM public.idempotency_keys WHERE expires_at < NOW() RETURNING 1)
  SELECT COUNT(*)::INTEGER INTO v_deleted FROM d;
  RETURN v_deleted;
END;
$$;

COMMENT ON FUNCTION public.prune_expired_idempotency_keys IS 'Cron: delete expired idempotency keys. Returns number of rows deleted.';

-- =============================================================================
-- PART 2: Payments idempotency – CHECK and index
-- =============================================================================

-- Ensure idempotency_key when present is non-empty and bounded (avoid abuse)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.payments'::regclass
      AND conname = 'payments_idempotency_key_format'
  ) THEN
    ALTER TABLE public.payments
    ADD CONSTRAINT payments_idempotency_key_format
    CHECK (idempotency_key IS NULL OR (length(trim(idempotency_key)) >= 1 AND length(idempotency_key) <= 512));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_payments_idempotency ON public.payments (idempotency_key) WHERE idempotency_key IS NOT NULL;

COMMENT ON COLUMN public.payments.idempotency_key IS 'Idempotency: duplicate requests with same key return same payment. UNIQUE enforced at table level.';

-- =============================================================================
-- PART 3: FORCE ROW LEVEL SECURITY (business rule: even table owner obeys RLS)
-- =============================================================================

ALTER TABLE public.user_profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.businesses FORCE ROW LEVEL SECURITY;
ALTER TABLE public.bookings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.slots FORCE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.payments FORCE ROW LEVEL SECURITY;

-- =============================================================================
-- PART 4: Booking status transition trigger (business rule: valid state machine)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.check_booking_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- pending -> confirmed | rejected | cancelled
  IF OLD.status = 'pending' AND NEW.status NOT IN ('confirmed', 'rejected', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid booking transition: pending -> %', NEW.status;
  END IF;

  -- confirmed -> cancelled (or no_show update without status change)
  IF OLD.status = 'confirmed' AND NEW.status NOT IN ('cancelled') THEN
    RAISE EXCEPTION 'Invalid booking transition: confirmed -> %', NEW.status;
  END IF;

  -- rejected | cancelled -> no further transitions
  IF OLD.status IN ('rejected', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid booking transition: % is terminal', OLD.status;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_booking_status_transition ON public.bookings;
CREATE TRIGGER trg_booking_status_transition
  BEFORE UPDATE OF status ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.check_booking_status_transition();

-- =============================================================================
-- PART 5: Slot status transition trigger (business rule: available <-> reserved <-> booked)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.check_slot_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- available -> reserved | booked
  IF OLD.status = 'available' AND NEW.status NOT IN ('reserved', 'booked') THEN
    RAISE EXCEPTION 'Invalid slot transition: available -> %', NEW.status;
  END IF;

  -- reserved -> available | booked
  IF OLD.status = 'reserved' AND NEW.status NOT IN ('available', 'booked') THEN
    RAISE EXCEPTION 'Invalid slot transition: reserved -> %', NEW.status;
  END IF;

  -- booked is terminal (slot stays booked)
  IF OLD.status = 'booked' THEN
    RAISE EXCEPTION 'Invalid slot transition: booked is terminal';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_slot_status_transition ON public.slots;
CREATE TRIGGER trg_slot_status_transition
  BEFORE UPDATE OF status ON public.slots
  FOR EACH ROW
  EXECUTE FUNCTION public.check_slot_status_transition();

-- =============================================================================
-- PART 6: Business rule CHECKs (invariants)
-- =============================================================================

-- Booking: if cancelled, cancelled_at should be set; if no_show then status should be confirmed (or allow pending for edge cases – app may set no_show after confirm)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.bookings'::regclass AND conname = 'bookings_cancelled_invariant') THEN
    ALTER TABLE public.bookings
    ADD CONSTRAINT bookings_cancelled_invariant
    CHECK (status <> 'cancelled' OR cancelled_at IS NOT NULL);
  END IF;
END $$;

-- Business: slot_duration positive, opening/closing sensible (optional)
-- Business closures: end_date >= start_date (may already exist from migration_phase1_downtime)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.business_closures'::regclass AND conname = 'business_closures_dates_order') THEN
    ALTER TABLE public.business_closures
    ADD CONSTRAINT business_closures_dates_order
    CHECK (end_date >= start_date);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- PART 7: Table and column comments (business rules documentation)
-- =============================================================================

COMMENT ON TABLE public.bookings IS 'Bookings: created via create_booking_atomically only. Status: pending -> confirmed|rejected|cancelled; confirmed -> cancelled. booking_id is unique and used for idempotency.';
COMMENT ON TABLE public.slots IS 'Slots: status available -> reserved -> booked. reserved can revert to available on expiry. Only service/backend can insert or update.';
COMMENT ON TABLE public.businesses IS 'Businesses: owner_user_id links to auth.users. Only owner or admin can update.';
COMMENT ON TABLE public.user_profiles IS 'User profiles: id = auth.users.id. Only own profile or admin can update.';
COMMENT ON TABLE public.payments IS 'Payments: idempotency_key ensures duplicate API calls return same payment. Only service role should insert/update.';
COMMENT ON TABLE public.audit_logs IS 'Audit: only service role can insert. Admins can select.';
COMMENT ON TABLE public.request_nonces IS 'Request nonces: one-time use per nonce to prevent replay. TTL enforced by application.';
COMMENT ON COLUMN public.bookings.booking_id IS 'Unique client-facing id; used for idempotent booking creation (same id = same booking).';
COMMENT ON COLUMN public.bookings.status IS 'pending | confirmed | rejected | cancelled. Transitions enforced by trigger.';