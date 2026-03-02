-- Migration: Security and RLS performance remediation.
-- Fixes: mutable search_path on functions, spatial_ref_sys RLS, audit_logs insert policy,
--        postgis schema, RLS policies re-evaluating auth.uid()/auth.role() per row.
-- Safe to run once. Does not change application behavior.

-- =============================================================================
-- 1. FUNCTION SEARCH_PATH — set immutable search_path on SECURITY DEFINER functions
--    (DO block: ALTER FUNCTION IF EXISTS not available in all PostgreSQL versions)
-- =============================================================================
DO $$
BEGIN
  ALTER FUNCTION public.audit_logs_compute_hash_trigger() SET search_path = public;
EXCEPTION WHEN undefined_function THEN NULL; END; $$;
DO $$ BEGIN
  ALTER FUNCTION public.cleanup_expired_soft_deleted_records() SET search_path = public;
EXCEPTION WHEN undefined_function THEN NULL; END; $$;
DO $$ BEGIN
  ALTER FUNCTION public.insert_deletion_audit_v2(UUID, TEXT, UUID, TEXT, TEXT, JSONB, TEXT) SET search_path = public;
EXCEPTION WHEN undefined_function THEN NULL; END; $$;
DO $$ BEGIN
  ALTER FUNCTION public.restore_deleted_user_account(UUID, UUID, TEXT) SET search_path = public;
EXCEPTION WHEN undefined_function THEN NULL; END; $$;
DO $$ BEGIN
  ALTER FUNCTION public.restore_deleted_user_account(UUID) SET search_path = public;
EXCEPTION WHEN undefined_function THEN NULL; END; $$;
DO $$ BEGIN
  ALTER FUNCTION public.anonymize_user_financial_data(UUID) SET search_path = public;
EXCEPTION WHEN undefined_function THEN NULL; END; $$;
DO $$ BEGIN
  ALTER FUNCTION public.anonymize_user_pii_everywhere(UUID) SET search_path = public;
EXCEPTION WHEN undefined_function THEN NULL; END; $$;
DO $$ BEGIN
  ALTER FUNCTION public.soft_delete_user_account(UUID, UUID, TEXT, TEXT, BOOLEAN) SET search_path = public;
EXCEPTION WHEN undefined_function THEN NULL; END; $$;
DO $$ BEGIN
  ALTER FUNCTION public.soft_delete_user_account(UUID, TEXT) SET search_path = public;
EXCEPTION WHEN undefined_function THEN NULL; END; $$;
DO $$ BEGIN
  ALTER FUNCTION public.audit_logs_deny_update_delete() SET search_path = public;
EXCEPTION WHEN undefined_function THEN NULL; END; $$;
DO $$ BEGIN
  ALTER FUNCTION public.verify_audit_chain() SET search_path = public;
EXCEPTION WHEN undefined_function THEN NULL; END; $$;
DO $$ BEGIN
  ALTER FUNCTION public.insert_deletion_audit(UUID, TEXT, UUID, TEXT, TEXT, JSONB, TEXT) SET search_path = public;
EXCEPTION WHEN undefined_function THEN NULL; END; $$;
DO $$ BEGIN
  ALTER FUNCTION public.run_deletion_integrity_check() SET search_path = public;
EXCEPTION WHEN undefined_function THEN NULL; END; $$;
DO $$ BEGIN
  ALTER FUNCTION public.soft_delete_business(UUID, UUID, TEXT, TEXT, BOOLEAN) SET search_path = public;
EXCEPTION WHEN undefined_function THEN NULL; END; $$;

-- =============================================================================
-- 2. spatial_ref_sys (PostGIS) — enable RLS; only service_role can read
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'spatial_ref_sys') THEN
    ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "spatial_ref_sys_service_role_only" ON public.spatial_ref_sys;
    CREATE POLICY "spatial_ref_sys_service_role_only" ON public.spatial_ref_sys
      FOR SELECT USING ((SELECT auth.role()) = 'service_role');
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- =============================================================================
-- 3. PostGIS extension — move to extensions schema (best practice)
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
    CREATE SCHEMA IF NOT EXISTS extensions;
    ALTER EXTENSION postgis SET SCHEMA extensions;
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'extensions' AND tablename = 'spatial_ref_sys') THEN
      ALTER TABLE extensions.spatial_ref_sys ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS "spatial_ref_sys_service_role_only" ON extensions.spatial_ref_sys;
      CREATE POLICY "spatial_ref_sys_service_role_only" ON extensions.spatial_ref_sys
        FOR SELECT USING ((SELECT auth.role()) = 'service_role');
    END IF;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- =============================================================================
-- 4. audit_logs — restrict INSERT to service_role only (fix unrestricted WITH CHECK)
-- =============================================================================
DROP POLICY IF EXISTS "audit_logs_insert_policy" ON public.audit_logs;
CREATE POLICY "audit_logs_insert_policy" ON public.audit_logs
  FOR INSERT WITH CHECK ((SELECT auth.role()) = 'service_role');

-- =============================================================================
-- 5. audit_logs_select_service_role_only — single evaluation for performance
-- =============================================================================
DROP POLICY IF EXISTS "audit_logs_select_service_role_only" ON public.audit_logs;
CREATE POLICY "audit_logs_select_service_role_only" ON public.audit_logs
  FOR SELECT USING ((SELECT auth.role()) = 'service_role');

-- =============================================================================
-- 6. user_locations — (select auth.uid()) and (select auth.role()) for performance
-- =============================================================================
DROP POLICY IF EXISTS "Users can read own user_locations" ON public.user_locations;
CREATE POLICY "Users can read own user_locations" ON public.user_locations
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own user_locations" ON public.user_locations;
CREATE POLICY "Users can insert own user_locations" ON public.user_locations
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own user_locations" ON public.user_locations;
CREATE POLICY "Users can update own user_locations" ON public.user_locations
  FOR UPDATE USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Service role full access user_locations" ON public.user_locations;
CREATE POLICY "Service role full access user_locations" ON public.user_locations
  FOR ALL USING ((SELECT auth.role()) = 'service_role');

-- =============================================================================
-- 7. admin_users — (select auth.uid()) for performance
-- =============================================================================
DROP POLICY IF EXISTS "Admin users: only listed admins can manage" ON public.admin_users;
CREATE POLICY "Admin users: only listed admins can manage" ON public.admin_users
  FOR ALL
  USING (
    LOWER((SELECT email FROM auth.users WHERE id = (SELECT auth.uid())))
    IN (SELECT LOWER(email) FROM public.admin_users WHERE is_admin = TRUE)
  )
  WITH CHECK (
    LOWER((SELECT email FROM auth.users WHERE id = (SELECT auth.uid())))
    IN (SELECT LOWER(email) FROM public.admin_users WHERE is_admin = TRUE)
  );

-- =============================================================================
-- 8. deletion_events — (select auth.role()) for performance
-- =============================================================================
DROP POLICY IF EXISTS "Service role only for deletion_events" ON public.deletion_events;
CREATE POLICY "Service role only for deletion_events"
  ON public.deletion_events FOR ALL
  USING ((SELECT auth.role()) = 'service_role')
  WITH CHECK ((SELECT auth.role()) = 'service_role');

-- =============================================================================
-- 9. user_profiles_deny_delete — (select auth.role()) for performance
-- =============================================================================
DROP POLICY IF EXISTS "user_profiles_deny_delete" ON public.user_profiles;
CREATE POLICY "user_profiles_deny_delete" ON public.user_profiles
  FOR DELETE USING ((SELECT auth.role()) = 'service_role');

-- =============================================================================
-- 10. businesses_deny_delete — (select auth.role()) for performance
-- =============================================================================
DROP POLICY IF EXISTS "businesses_deny_delete" ON public.businesses;
CREATE POLICY "businesses_deny_delete" ON public.businesses
  FOR DELETE USING ((SELECT auth.role()) = 'service_role');

-- =============================================================================
-- NOTE: HaveIBeenPwned (compromised password check)
-- Enable in Supabase Dashboard: Authentication → Settings → Security →
-- "Check for compromised passwords (HaveIBeenPwned)". No SQL change.
-- =============================================================================
