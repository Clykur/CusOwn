-- Migration: Media uploads — business photos and profile images.
-- Creates media table, links to user_profiles and businesses. Safe to run when tables exist.
-- Storage: files live in Supabase Storage (bucket per config); this table tracks metadata and referential integrity.

-- ============================================
-- PART 1: Media table
-- ============================================

CREATE TABLE IF NOT EXISTS public.media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('business', 'profile')),
  entity_id UUID NOT NULL,
  storage_path TEXT NOT NULL,
  bucket_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

COMMENT ON TABLE public.media IS 'Metadata for uploaded files: business photos and profile images. Actual files in Supabase Storage.';
COMMENT ON COLUMN public.media.entity_type IS 'business = business gallery; profile = user profile picture.';
COMMENT ON COLUMN public.media.entity_id IS 'business.id for business photos; auth.users.id for profile.';
COMMENT ON COLUMN public.media.storage_path IS 'Path within bucket (no leading slash).';
COMMENT ON COLUMN public.media.sort_order IS 'Display order; used for business gallery.';

-- Indexes for list/detail and soft delete
CREATE INDEX IF NOT EXISTS idx_media_entity ON public.media (entity_type, entity_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_media_entity_deleted ON public.media (entity_type, entity_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_media_created_at ON public.media (created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_media_profile_one_per_user
  ON public.media (entity_id)
  WHERE entity_type = 'profile' AND deleted_at IS NULL;

-- Trigger updated_at
CREATE TRIGGER update_media_updated_at
  BEFORE UPDATE ON public.media
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- PART 2: user_profiles.profile_media_id
-- ============================================

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS profile_media_id UUID REFERENCES public.media(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_user_profiles_profile_media_id
  ON public.user_profiles(profile_media_id) WHERE profile_media_id IS NOT NULL;

COMMENT ON COLUMN public.user_profiles.profile_media_id IS 'Current profile picture; references media where entity_type=profile.';

-- ============================================
-- PART 3: RLS on media
-- ============================================

ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;

-- Service role / app backend performs all write and read via service client; RLS allows read for own profile and business owner
-- Public read for business media (customer UI): allow SELECT where entity_type = 'business' (listing/detail pages use signed URLs or public bucket policy in Supabase)
-- For strict server-only access: no direct anon read; all URLs served via signed URLs from API.
-- Use (SELECT auth.uid()) for RLS performance at scale (Supabase linter).
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

-- Business media: customers need to see them (for listing/detail). Allow public read for business media so API can fetch metadata and serve signed URLs.
CREATE POLICY "Public can view business media"
  ON public.media FOR SELECT
  USING (entity_type = 'business' AND deleted_at IS NULL);

-- Insert: profile = own user id; business = owner of business
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

-- Update: same as insert (reorder, etc.)
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

-- Delete: same
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
-- PART 4: Audit log support (media entity and actions)
-- ============================================

DO $$
DECLARE
  cname TEXT;
  ename TEXT;
BEGIN
  SELECT tc.constraint_name INTO cname
  FROM information_schema.table_constraints tc
  WHERE tc.table_schema = 'public' AND tc.table_name = 'audit_logs'
    AND tc.constraint_type = 'CHECK'
    AND tc.constraint_name LIKE '%action_type%'
  LIMIT 1;
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE audit_logs DROP CONSTRAINT %I', cname);
  END IF;
EXCEPTION WHEN OTHERS THEN
  ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_type_check;
END $$;

ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_action_type_check
  CHECK (action_type IN (
    'booking_created', 'booking_confirmed', 'booking_rejected', 'booking_cancelled',
    'booking_rescheduled', 'booking_no_show', 'booking_updated', 'booking_undo_accept', 'booking_undo_reject',
    'business_created', 'business_updated', 'business_deleted', 'business_suspended',
    'user_created', 'user_updated', 'user_deleted', 'role_changed', 'admin_login', 'admin_access_denied',
    'login_success', 'login_failed', 'password_reset',
    'payment_created', 'payment_succeeded', 'payment_failed', 'payment_refunded',
    'slot_reserved', 'slot_released', 'slot_booked',
    'notification_sent', 'data_corrected', 'system_config_changed', 'admin_revenue_export',
    'config_updated', 'cron_failed', 'cron_recovered', 'data_correction',
    'media_uploaded', 'media_deleted'
  ));

DO $$
DECLARE
  ename TEXT;
BEGIN
  SELECT tc.constraint_name INTO ename
  FROM information_schema.table_constraints tc
  WHERE tc.table_schema = 'public' AND tc.table_name = 'audit_logs'
    AND tc.constraint_type = 'CHECK'
    AND tc.constraint_name LIKE '%entity_type%'
  LIMIT 1;
  IF ename IS NOT NULL THEN
    EXECUTE format('ALTER TABLE audit_logs DROP CONSTRAINT %I', ename);
  END IF;
EXCEPTION WHEN OTHERS THEN
  ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_entity_type_check;
END $$;

ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_entity_type_check
  CHECK (entity_type IN ('business', 'user', 'booking', 'system', 'slot', 'payment', 'media'));
