-- Migration: Supabase linter remediation — RLS, function search_path, RLS performance, duplicate indexes.
-- Addresses: rls_disabled_in_public (business_categories), function_search_path_mutable,
-- rls_policy_always_true (auth_events, cron_run_logs), RLS auth.uid() performance (media),
-- identical indexes (audit_logs, bookings). Safe when objects exist.
--
-- Not fixed here (Dashboard / Auth): auth_leaked_password_protection — enable in Supabase Dashboard
-- under Authentication > Settings > Password Protection.

-- ============================================
-- PART 1: RLS on public.business_categories
-- ============================================

ALTER TABLE public.business_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read business_categories" ON public.business_categories;

CREATE POLICY "Public can read business_categories"
  ON public.business_categories FOR SELECT
  USING (true);

-- ============================================
-- PART 2: Function search_path = public (security)
-- ============================================

CREATE OR REPLACE FUNCTION public.check_media_business_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_max INTEGER := 20;
BEGIN
  IF NEW.entity_type <> 'business' OR NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  SELECT COUNT(*)::INTEGER INTO v_count
  FROM public.media
  WHERE entity_type = 'business' AND entity_id = NEW.entity_id AND deleted_at IS NULL;
  IF v_count >= v_max THEN
    RAISE EXCEPTION 'MEDIA_MAX_BUSINESS_IMAGES: business image limit reached'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_idempotency_result_generic(
  p_key TEXT,
  p_resource_type TEXT
)
RETURNS TABLE(result_id UUID, response_snapshot JSONB)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF trim(p_key) = '' OR length(p_key) > 512 THEN
    RAISE EXCEPTION 'idempotency key must be non-empty and at most 512 chars';
  END IF;
  RETURN QUERY
  SELECT ik.result_id, ik.response_snapshot
  FROM public.idempotency_keys ik
  WHERE ik.key = p_key
    AND ik.resource_type = p_resource_type
    AND ik.expires_at > NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.set_idempotency_result_with_snapshot(
  p_key TEXT,
  p_resource_type TEXT,
  p_result_id UUID,
  p_response_snapshot JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_expires_at TIMESTAMP WITH TIME ZONE := NOW() + INTERVAL '24 hours';
BEGIN
  UPDATE public.idempotency_keys
  SET result_id = p_result_id,
      response_snapshot = p_response_snapshot,
      expires_at = v_expires_at
  WHERE key = p_key AND resource_type = p_resource_type AND expires_at > NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.purge_soft_deleted_media(p_retention_days INTEGER DEFAULT 30)
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_cutoff TIMESTAMP WITH TIME ZONE;
  v_deleted INTEGER;
BEGIN
  v_cutoff := NOW() - (p_retention_days || ' days')::INTERVAL;
  WITH d AS (
    DELETE FROM public.media
    WHERE deleted_at IS NOT NULL AND deleted_at < v_cutoff
    RETURNING 1
  )
  SELECT COUNT(*)::INTEGER INTO v_deleted FROM d;
  RETURN v_deleted;
END;
$$;

-- seed_business_hours: set search_path if function exists (may be from another migration or dashboard).
DO $$
DECLARE
  v_oid OID;
  v_args TEXT;
BEGIN
  SELECT p.oid, pg_get_function_identity_arguments(p.oid) INTO v_oid, v_args
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public' AND p.proname = 'seed_business_hours'
  LIMIT 1;
  IF v_oid IS NOT NULL THEN
    EXECUTE format('ALTER FUNCTION public.seed_business_hours(%s) SET search_path = public', v_args);
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- ============================================
-- PART 3: auth_events — remove permissive INSERT; fix SELECT for performance
-- ============================================

DROP POLICY IF EXISTS "System can insert auth_events" ON public.auth_events;

DROP POLICY IF EXISTS "Admins can view auth_events" ON public.auth_events;

CREATE POLICY "Admins can view auth_events" ON public.auth_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = (SELECT auth.uid()) AND up.user_type = 'admin'
    )
  );

-- ============================================
-- PART 4: cron_run_logs — remove permissive INSERT; fix SELECT for performance
-- ============================================

DROP POLICY IF EXISTS "Service can insert cron_run_logs" ON public.cron_run_logs;

DROP POLICY IF EXISTS "Admins can view cron_run_logs" ON public.cron_run_logs;

CREATE POLICY "Admins can view cron_run_logs" ON public.cron_run_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = (SELECT auth.uid()) AND up.user_type = 'admin'
    )
  );

-- ============================================
-- PART 5: media — RLS policies with (select auth.uid()) for performance
-- ============================================

DROP POLICY IF EXISTS "Users can view own profile media" ON public.media;
DROP POLICY IF EXISTS "Public can view business media" ON public.media;
DROP POLICY IF EXISTS "Users can insert own profile media" ON public.media;
DROP POLICY IF EXISTS "Owners can insert business media" ON public.media;
DROP POLICY IF EXISTS "Users can update own profile media" ON public.media;
DROP POLICY IF EXISTS "Owners can update business media" ON public.media;
DROP POLICY IF EXISTS "Users can delete own profile media" ON public.media;
DROP POLICY IF EXISTS "Owners can delete business media" ON public.media;

CREATE POLICY "Users can view own profile media"
  ON public.media FOR SELECT
  USING (
    (entity_type = 'profile' AND entity_id = (SELECT auth.uid()))
    OR
    (entity_type = 'business' AND EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = media.entity_id AND b.owner_user_id = (SELECT auth.uid())
    ))
  );

CREATE POLICY "Public can view business media"
  ON public.media FOR SELECT
  USING (entity_type = 'business' AND deleted_at IS NULL);

CREATE POLICY "Users can insert own profile media"
  ON public.media FOR INSERT
  WITH CHECK (entity_type = 'profile' AND entity_id = (SELECT auth.uid()));

CREATE POLICY "Owners can insert business media"
  ON public.media FOR INSERT
  WITH CHECK (
    entity_type = 'business'
    AND EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = media.entity_id AND b.owner_user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can update own profile media"
  ON public.media FOR UPDATE
  USING (entity_type = 'profile' AND entity_id = (SELECT auth.uid()));

CREATE POLICY "Owners can update business media"
  ON public.media FOR UPDATE
  USING (
    entity_type = 'business'
    AND EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = media.entity_id AND b.owner_user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can delete own profile media"
  ON public.media FOR DELETE
  USING (entity_type = 'profile' AND entity_id = (SELECT auth.uid()));

CREATE POLICY "Owners can delete business media"
  ON public.media FOR DELETE
  USING (
    entity_type = 'business'
    AND EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = media.entity_id AND b.owner_user_id = (SELECT auth.uid())
    )
  );

-- ============================================
-- PART 6: Duplicate indexes — drop redundant
-- ============================================

DROP INDEX IF EXISTS public.idx_audit_logs_created_at;

DROP INDEX IF EXISTS public.idx_bookings_business;
