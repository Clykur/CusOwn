-- Migration: Fix RLS error (spatial_ref_sys), consolidate multiple permissive policies, add unindexed FK indexes.
-- Safe to run once. Preserves same access semantics; one policy per (table, action) for performance.

-- =============================================================================
-- 1. spatial_ref_sys (PostGIS) — enable RLS so table is not exposed without RLS
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'spatial_ref_sys') THEN
    ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "spatial_ref_sys_service_role_only" ON public.spatial_ref_sys;
    CREATE POLICY "spatial_ref_sys_service_role_only" ON public.spatial_ref_sys
      FOR SELECT USING ((SELECT auth.role()) = 'service_role');
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- =============================================================================
-- 2. Unindexed foreign keys — add covering indexes
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_user_id ON public.audit_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_booking_services_service_id ON public.booking_services(service_id);
CREATE INDEX IF NOT EXISTS idx_booking_transition_audit_actor_id ON public.booking_transition_audit(actor_id);
CREATE INDEX IF NOT EXISTS idx_payment_audit_logs_actor_id ON public.payment_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_request_nonces_user_id ON public.request_nonces(user_id);

-- =============================================================================
-- 3. bookings — single policy per action (SELECT: customer OR owner OR admin)
-- =============================================================================
DROP POLICY IF EXISTS "Admins can view all bookings" ON public.bookings;
DROP POLICY IF EXISTS "Customers can view own bookings" ON public.bookings;
CREATE POLICY "bookings_select" ON public.bookings
  FOR SELECT USING (
    customer_user_id = (SELECT auth.uid())
    OR EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = bookings.business_id AND b.owner_user_id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = (SELECT auth.uid()) AND up.user_type = 'admin')
  );

-- =============================================================================
-- 4. businesses — single policy per action (SELECT/UPDATE: owner OR admin)
-- =============================================================================
DROP POLICY IF EXISTS "Admins can view all businesses" ON public.businesses;
DROP POLICY IF EXISTS "Owners can view own businesses" ON public.businesses;
DROP POLICY IF EXISTS "Admins can update any business" ON public.businesses;
DROP POLICY IF EXISTS "Owners can update own businesses" ON public.businesses;
DROP POLICY IF EXISTS "Owners can insert own businesses" ON public.businesses;

CREATE POLICY "businesses_select" ON public.businesses
  FOR SELECT USING (
    owner_user_id = (SELECT auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = (SELECT auth.uid()) AND up.user_type = 'admin')
  );
CREATE POLICY "businesses_update" ON public.businesses
  FOR UPDATE USING (
    owner_user_id = (SELECT auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = (SELECT auth.uid()) AND up.user_type = 'admin')
  );
CREATE POLICY "businesses_insert" ON public.businesses
  FOR INSERT WITH CHECK (owner_user_id = (SELECT auth.uid()));

-- =============================================================================
-- 5. media — single policy per action (SELECT: profile own / business own / public business; INSERT/UPDATE/DELETE: profile own OR business owner)
-- =============================================================================
DROP POLICY IF EXISTS "Users can view own profile media" ON public.media;
DROP POLICY IF EXISTS "Public can view business media" ON public.media;
DROP POLICY IF EXISTS "Users can insert own profile media" ON public.media;
DROP POLICY IF EXISTS "Owners can insert business media" ON public.media;
DROP POLICY IF EXISTS "Users can update own profile media" ON public.media;
DROP POLICY IF EXISTS "Owners can update business media" ON public.media;
DROP POLICY IF EXISTS "Users can delete own profile media" ON public.media;
DROP POLICY IF EXISTS "Owners can delete business media" ON public.media;

CREATE POLICY "media_select" ON public.media
  FOR SELECT USING (
    (entity_type = 'profile' AND entity_id = (SELECT auth.uid()))
    OR (entity_type = 'business' AND deleted_at IS NULL)
    OR (entity_type = 'business' AND EXISTS (
      SELECT 1 FROM public.businesses b WHERE b.id = media.entity_id AND b.owner_user_id = (SELECT auth.uid())
    ))
  );
CREATE POLICY "media_insert" ON public.media
  FOR INSERT WITH CHECK (
    (entity_type = 'profile' AND entity_id = (SELECT auth.uid()))
    OR (entity_type = 'business' AND EXISTS (
      SELECT 1 FROM public.businesses b WHERE b.id = media.entity_id AND b.owner_user_id = (SELECT auth.uid())
    ))
  );
CREATE POLICY "media_update" ON public.media
  FOR UPDATE USING (
    (entity_type = 'profile' AND entity_id = (SELECT auth.uid()))
    OR (entity_type = 'business' AND EXISTS (
      SELECT 1 FROM public.businesses b WHERE b.id = media.entity_id AND b.owner_user_id = (SELECT auth.uid())
    ))
  );
CREATE POLICY "media_delete" ON public.media
  FOR DELETE USING (
    (entity_type = 'profile' AND entity_id = (SELECT auth.uid()))
    OR (entity_type = 'business' AND EXISTS (
      SELECT 1 FROM public.businesses b WHERE b.id = media.entity_id AND b.owner_user_id = (SELECT auth.uid())
    ))
  );

-- =============================================================================
-- 6. slots — single policy per action (SELECT: public available OR owner OR admin; UPDATE: owner OR admin)
-- =============================================================================
DROP POLICY IF EXISTS "Admins can view all slots" ON public.slots;
DROP POLICY IF EXISTS "Owners can view slots for their businesses" ON public.slots;
DROP POLICY IF EXISTS "Public can view available slots" ON public.slots;
DROP POLICY IF EXISTS "Admins can update all slots" ON public.slots;
DROP POLICY IF EXISTS "Owners can update slots for their businesses" ON public.slots;

CREATE POLICY "slots_select" ON public.slots
  FOR SELECT USING (
    status IN ('available', 'reserved')
    OR EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = slots.business_id AND b.owner_user_id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = (SELECT auth.uid()) AND up.user_type = 'admin')
  );
CREATE POLICY "slots_update" ON public.slots
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = slots.business_id AND b.owner_user_id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = (SELECT auth.uid()) AND up.user_type = 'admin')
  );

-- =============================================================================
-- 7. user_locations — single policy per action (own row OR service_role)
-- =============================================================================
DROP POLICY IF EXISTS "Users can read own user_locations" ON public.user_locations;
DROP POLICY IF EXISTS "Users can insert own user_locations" ON public.user_locations;
DROP POLICY IF EXISTS "Users can update own user_locations" ON public.user_locations;
DROP POLICY IF EXISTS "Service role full access user_locations" ON public.user_locations;

CREATE POLICY "user_locations_select" ON public.user_locations
  FOR SELECT USING (
    (SELECT auth.uid()) = user_id OR (SELECT auth.role()) = 'service_role'
  );
CREATE POLICY "user_locations_insert" ON public.user_locations
  FOR INSERT WITH CHECK (
    (SELECT auth.uid()) = user_id OR (SELECT auth.role()) = 'service_role'
  );
CREATE POLICY "user_locations_update" ON public.user_locations
  FOR UPDATE USING (
    (SELECT auth.uid()) = user_id OR (SELECT auth.role()) = 'service_role'
  );
CREATE POLICY "user_locations_delete" ON public.user_locations
  FOR DELETE USING ((SELECT auth.role()) = 'service_role');

-- =============================================================================
-- 8. user_profiles — single policy per action (own row OR admin)
-- =============================================================================
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.user_profiles;

CREATE POLICY "user_profiles_select" ON public.user_profiles
  FOR SELECT USING (
    (SELECT auth.uid()) = id
    OR EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = (SELECT auth.uid()) AND up.user_type = 'admin')
  );
CREATE POLICY "user_profiles_insert" ON public.user_profiles
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = id);
CREATE POLICY "user_profiles_update" ON public.user_profiles
  FOR UPDATE USING (
    (SELECT auth.uid()) = id
    OR EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = (SELECT auth.uid()) AND up.user_type = 'admin')
  );

-- user_profiles_deny_delete and businesses_deny_delete remain (single policy each for DELETE).
