-- Migration: Fix spatial_ref_sys RLS error, move PostGIS to extensions, add policies for tables with RLS but no policy.
-- Run after migration_rls_consolidate_and_fk_indexes.migration.sql.

-- =============================================================================
-- 1. spatial_ref_sys in public — enable RLS if we have ownership (extension-owned table often not owned by app role)
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'spatial_ref_sys') THEN
    ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "spatial_ref_sys_service_role_only" ON public.spatial_ref_sys;
    CREATE POLICY "spatial_ref_sys_service_role_only" ON public.spatial_ref_sys
      FOR SELECT USING ((SELECT auth.role()) = 'service_role');
  END IF;
EXCEPTION
  WHEN insufficient_privilege THEN NULL;  -- spatial_ref_sys is owned by extension; run as DB owner to enable RLS
END $$;

-- =============================================================================
-- 2. PostGIS — move extension to extensions schema (fix extension_in_public warning)
-- =============================================================================
DO $$
BEGIN
  CREATE SCHEMA IF NOT EXISTS extensions;
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
    ALTER EXTENSION postgis SET SCHEMA extensions;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- =============================================================================
-- 3. spatial_ref_sys in extensions — enable RLS after move (skip if not owner)
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'extensions' AND table_name = 'spatial_ref_sys') THEN
    ALTER TABLE extensions.spatial_ref_sys ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "spatial_ref_sys_service_role_only" ON extensions.spatial_ref_sys;
    CREATE POLICY "spatial_ref_sys_service_role_only" ON extensions.spatial_ref_sys
      FOR SELECT USING ((SELECT auth.role()) = 'service_role');
  END IF;
EXCEPTION
  WHEN insufficient_privilege THEN NULL;
END $$;

-- =============================================================================
-- 4. Tables with RLS but no policy — add service_role-only policy (backend-only access)
-- =============================================================================
DO $$
DECLARE
  t text;
  tbls text[] := ARRAY[
    'booking_reminders','booking_services','booking_state_transitions','booking_states',
    'booking_transition_audit','business_closures','business_holidays','business_special_hours',
    'idempotency_keys','metric_timings','metrics','notification_history','notification_preferences',
    'payment_attempts','payment_audit_logs','payments','permissions','request_nonces',
    'role_permissions','roles','services','user_roles'
  ];
BEGIN
  FOREACH t IN ARRAY tbls
  LOOP
    BEGIN
      EXECUTE format(
        'DROP POLICY IF EXISTS "service_role_only_%s" ON public.%I',
        t, t
      );
      EXECUTE format(
        'CREATE POLICY "service_role_only_%s" ON public.%I FOR ALL USING ((SELECT auth.role()) = ''service_role'') WITH CHECK ((SELECT auth.role()) = ''service_role'')',
        t, t
      );
    EXCEPTION WHEN undefined_table THEN NULL;
    END;
  END LOOP;
END $$;

-- NOTE: Leaked password protection (HaveIBeenPwned): enable in Supabase Dashboard
-- Authentication → Settings → Security → "Check for compromised passwords".
