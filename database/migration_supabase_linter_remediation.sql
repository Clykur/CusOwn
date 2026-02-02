-- Migration: Supabase Database Linter Remediation
-- Fixes: SECURITY DEFINER views, RLS disabled on public tables, function search_path,
--        permissive audit policy, auth RLS initplan (performance), duplicate policies.
-- Safe to run once. Idempotent where possible.
-- Run in Supabase SQL Editor or via migration runner.

-- =============================================================================
-- PART 1: Views – SECURITY INVOKER (fix security_definer_view)
-- =============================================================================
-- Recreate analytics views so they run with invoker's permissions, not definer's.

DROP VIEW IF EXISTS customer_retention;
DROP VIEW IF EXISTS booking_analytics_hourly;
DROP VIEW IF EXISTS booking_analytics_daily;

CREATE VIEW booking_analytics_daily
WITH (security_invoker = on)
AS
SELECT
  business_id,
  DATE(created_at) AS date,
  COUNT(*) AS total_bookings,
  COUNT(*) FILTER (WHERE status = 'confirmed') AS confirmed_bookings,
  COUNT(*) FILTER (WHERE status = 'rejected') AS rejected_bookings,
  COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled_bookings,
  COUNT(*) FILTER (WHERE no_show = TRUE) AS no_show_count
FROM bookings
GROUP BY business_id, DATE(created_at);

CREATE VIEW booking_analytics_hourly
WITH (security_invoker = on)
AS
SELECT
  b.business_id,
  DATE(s.date) AS date,
  EXTRACT(HOUR FROM s.start_time) AS hour,
  COUNT(*) AS booking_count
FROM bookings b
JOIN slots s ON b.slot_id = s.id
WHERE b.status = 'confirmed'
GROUP BY b.business_id, DATE(s.date), EXTRACT(HOUR FROM s.start_time);

CREATE VIEW customer_retention
WITH (security_invoker = on)
AS
SELECT
  business_id,
  customer_phone,
  COUNT(DISTINCT DATE(created_at)) AS booking_days,
  COUNT(*) AS total_bookings,
  MAX(created_at) AS last_booking_at,
  MIN(created_at) AS first_booking_at
FROM bookings
WHERE status IN ('confirmed', 'pending')
GROUP BY business_id, customer_phone;

-- =============================================================================
-- PART 2: Enable RLS on tables that are public but had RLS disabled
-- =============================================================================
-- No policies = only service_role (backend) can access. Application uses service role for these.

ALTER TABLE booking_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE metric_timings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_special_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_nonces ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_audit_logs ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- PART 3: Audit logs – drop permissive INSERT policy
-- =============================================================================
-- Only service role should insert audit logs. Dropping this policy enforces that.

DROP POLICY IF EXISTS "System can insert audit logs" ON audit_logs;

-- =============================================================================
-- PART 4: Functions – SET search_path = public (fix function_search_path_mutable)
-- =============================================================================

CREATE OR REPLACE FUNCTION increment_metric(metric_name TEXT, increment_value BIGINT DEFAULT 1)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  INSERT INTO metrics (metric, value)
  VALUES (metric_name, increment_value)
  ON CONFLICT (metric) DO UPDATE
  SET value = metrics.value + increment_value,
      updated_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION record_timing(metric_name TEXT, duration_ms INTEGER)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  INSERT INTO metric_timings (metric, duration_ms)
  VALUES (metric_name, duration_ms);

  DELETE FROM metric_timings
  WHERE metric = metric_name
  AND id NOT IN (
    SELECT id FROM metric_timings
    WHERE metric = metric_name
    ORDER BY recorded_at DESC
    LIMIT 1000
  );
END;
$$;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, user_type, full_name)
  VALUES (
    NEW.id,
    'customer',
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = auth.uid()
      AND user_type = 'admin'
  );
END;
$$;

-- Atomic / payment functions: add search_path without changing logic (ALTER only)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'create_booking_atomically') THEN
    ALTER FUNCTION create_booking_atomically(UUID, UUID, TEXT, TEXT, TEXT, UUID, INTEGER, INTEGER, INTEGER, JSONB) SET search_path = public;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'confirm_booking_atomically') THEN
    ALTER FUNCTION confirm_booking_atomically(UUID, UUID) SET search_path = public;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'expire_pending_bookings_atomically') THEN
    ALTER FUNCTION expire_pending_bookings_atomically(INTEGER) SET search_path = public;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'confirm_booking_with_payment') THEN
    ALTER FUNCTION confirm_booking_with_payment(UUID, UUID, UUID, UUID) SET search_path = public;
  END IF;
END
$$;

-- =============================================================================
-- PART 5: RLS policies – use (select auth.uid()) for performance (auth_rls_initplan)
-- =============================================================================
-- Replace auth.uid() with (select auth.uid()) so it is evaluated once per query.

-- user_profiles: drop duplicates then recreate with initplan-friendly expr
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON user_profiles;

CREATE POLICY "Users can view their own profile" ON user_profiles
  FOR SELECT USING ((SELECT auth.uid()) = id);

CREATE POLICY "Users can insert their own profile" ON user_profiles
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = id);

CREATE POLICY "Users can update their own profile" ON user_profiles
  FOR UPDATE USING ((SELECT auth.uid()) = id);

CREATE POLICY "Admins can view all profiles" ON user_profiles
  FOR SELECT USING ((SELECT auth.uid()) = id OR public.is_admin_user());

CREATE POLICY "Admins can update any profile" ON user_profiles
  FOR UPDATE USING ((SELECT auth.uid()) = id OR public.is_admin_user());

-- businesses
DROP POLICY IF EXISTS "Owners can view own businesses" ON businesses;
DROP POLICY IF EXISTS "Owners can update own businesses" ON businesses;
DROP POLICY IF EXISTS "Owners can insert own businesses" ON businesses;
DROP POLICY IF EXISTS "Admins can view all businesses" ON businesses;
DROP POLICY IF EXISTS "Admins can update any business" ON businesses;

CREATE POLICY "Owners can view own businesses" ON businesses
  FOR SELECT USING (owner_user_id = (SELECT auth.uid()));

CREATE POLICY "Owners can update own businesses" ON businesses
  FOR UPDATE USING (owner_user_id = (SELECT auth.uid()));

CREATE POLICY "Owners can insert own businesses" ON businesses
  FOR INSERT WITH CHECK (owner_user_id = (SELECT auth.uid()));

CREATE POLICY "Admins can view all businesses" ON businesses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = (SELECT auth.uid()) AND user_type = 'admin'
    )
  );

CREATE POLICY "Admins can update any business" ON businesses
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = (SELECT auth.uid()) AND user_type = 'admin'
    )
  );

-- bookings
DROP POLICY IF EXISTS "Customers can view own bookings" ON bookings;
DROP POLICY IF EXISTS "Customers can update own bookings" ON bookings;
DROP POLICY IF EXISTS "Admins can view all bookings" ON bookings;

CREATE POLICY "Customers can view own bookings" ON bookings
  FOR SELECT USING (
    customer_user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM businesses b
      WHERE b.id = bookings.business_id AND b.owner_user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Customers can update own bookings" ON bookings
  FOR UPDATE USING (
    customer_user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM businesses b
      WHERE b.id = bookings.business_id AND b.owner_user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Admins can view all bookings" ON bookings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = (SELECT auth.uid()) AND user_type = 'admin'
    )
  );

-- slots
DROP POLICY IF EXISTS "Public can view available slots" ON slots;
DROP POLICY IF EXISTS "Owners can view slots for their businesses" ON slots;
DROP POLICY IF EXISTS "Owners can update slots for their businesses" ON slots;
DROP POLICY IF EXISTS "Admins can view all slots" ON slots;
DROP POLICY IF EXISTS "Admins can update all slots" ON slots;

CREATE POLICY "Public can view available slots" ON slots
  FOR SELECT USING (status IN ('available', 'reserved'));

CREATE POLICY "Owners can view slots for their businesses" ON slots
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM businesses b
      WHERE b.id = slots.business_id AND b.owner_user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Owners can update slots for their businesses" ON slots
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM businesses b
      WHERE b.id = slots.business_id AND b.owner_user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Admins can view all slots" ON slots
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = (SELECT auth.uid()) AND user_type = 'admin'
    )
  );

CREATE POLICY "Admins can update all slots" ON slots
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = (SELECT auth.uid()) AND user_type = 'admin'
    )
  );

-- audit_logs
DROP POLICY IF EXISTS "Admins can view all audit logs" ON audit_logs;

CREATE POLICY "Admins can view all audit logs" ON audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = (SELECT auth.uid()) AND user_type = 'admin'
    )
  );

-- =============================================================================
-- PART 8: Unindexed foreign keys (linter: unindexed_foreign_keys)
-- =============================================================================
-- Add covering indexes for FK columns to avoid suboptimal JOIN/constraint checks.

CREATE INDEX IF NOT EXISTS idx_payments_refunded_by ON public.payments (refunded_by) WHERE refunded_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_verified_by ON public.payments (verified_by) WHERE verified_by IS NOT NULL;

-- =============================================================================
-- NOTES
-- =============================================================================
-- 1. Views: Run with invoker permissions; analytics access follows RLS on underlying tables.
-- 2. RLS on backend-only tables: Only service role can read/write (no policies = deny all others).
-- 3. Audit logs: Only service role can INSERT (policy removed).
-- 4. Functions: search_path = public avoids search_path injection.
-- 5. (select auth.uid()) in RLS: Single evaluation per query, better performance.
-- 6. Leaked password protection: Enable in Supabase Dashboard > Auth > Settings.
-- 7. Unused indexes: Optional migration_supabase_linter_unused_indexes.sql drops indexes
--    reported as unused; run only if you want to reduce write cost. Re-add if queries need them.
