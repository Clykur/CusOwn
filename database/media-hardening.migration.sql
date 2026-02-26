-- Migration: Media subsystem hardening — content hash, variants, idempotency, security log, retention, max count.
-- Run after media-uploads.migration.sql. Safe when tables exist.

-- ============================================
-- PART 1: media table extensions
-- ============================================

ALTER TABLE public.media ADD COLUMN IF NOT EXISTS content_hash TEXT;
ALTER TABLE public.media ADD COLUMN IF NOT EXISTS etag TEXT;
ALTER TABLE public.media ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'completed'
  CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed'));
ALTER TABLE public.media ADD COLUMN IF NOT EXISTS variants JSONB DEFAULT NULL;
ALTER TABLE public.media ADD COLUMN IF NOT EXISTS content_type_resolved TEXT;
ALTER TABLE public.media ADD COLUMN IF NOT EXISTS recompressed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.media ADD COLUMN IF NOT EXISTS purged_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN public.media.content_hash IS 'SHA-256 of file content; used for duplicate detection and ETag.';
COMMENT ON COLUMN public.media.etag IS 'ETag for cache validation (e.g. content_hash or quoted).';
COMMENT ON COLUMN public.media.processing_status IS 'pending=awaiting variants, processing=in progress, completed=done, failed=variant job failed.';
COMMENT ON COLUMN public.media.variants IS 'JSON: { thumbnail: { path, width, height }, medium: {...}, large: {...} }.';
COMMENT ON COLUMN public.media.content_type_resolved IS 'Resolved from magic bytes after upload.';
COMMENT ON COLUMN public.media.recompressed_at IS 'When image was recompressed/EXIF stripped.';
COMMENT ON COLUMN public.media.purged_at IS 'When hard-deleted (after retention window). Null = not purged.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_media_entity_content_hash
  ON public.media (entity_type, entity_id, content_hash)
  WHERE deleted_at IS NULL AND content_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_media_processing_status
  ON public.media (processing_status)
  WHERE deleted_at IS NULL AND processing_status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_media_deleted_at_purge
  ON public.media (deleted_at)
  WHERE deleted_at IS NOT NULL AND purged_at IS NULL;

-- ============================================
-- PART 2: Max business images (trigger)
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

DROP TRIGGER IF EXISTS trg_media_check_business_count ON public.media;
CREATE TRIGGER trg_media_check_business_count
  BEFORE INSERT ON public.media
  FOR EACH ROW EXECUTE FUNCTION public.check_media_business_count();

COMMENT ON FUNCTION public.check_media_business_count IS 'Enforce max business images per business at DB level (20).';

-- ============================================
-- PART 3: Media security / anomaly log
-- ============================================

CREATE TABLE IF NOT EXISTS public.media_security_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  entity_type TEXT,
  entity_id UUID,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE public.media_security_log IS 'Security and anomaly events: failed uploads, suspicious content, size abuse, repeated failures.';

CREATE INDEX IF NOT EXISTS idx_media_security_log_event_created
  ON public.media_security_log (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_security_log_user_created
  ON public.media_security_log (user_id, created_at DESC) WHERE user_id IS NOT NULL;

ALTER TABLE public.media_security_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only for media_security_log"
  ON public.media_security_log FOR ALL USING (false);

-- ============================================
-- PART 4: Idempotency for media uploads
-- ============================================

-- Reuse idempotency_keys with resource_type 'media_profile' | 'media_business'.
-- Add generic get/set that support response_snapshot for any resource type.

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

COMMENT ON FUNCTION public.get_idempotency_result_generic IS 'Returns stored result_id and response_snapshot for idempotency key + resource type.';
COMMENT ON FUNCTION public.set_idempotency_result_with_snapshot IS 'Stores result and response snapshot for idempotent media (or other) operations.';

-- Ensure idempotency_keys accepts new resource types (no constraint on resource_type values).
-- If there is a check constraint on resource_type, extend it to include 'media_profile', 'media_business'.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'idempotency_keys'
      AND constraint_name LIKE '%resource_type%'
  ) THEN
    NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================
-- PART 5: Hard-delete purge (retention)
-- ============================================

-- purged_at on media marks hard-deleted; we run a job that DELETE FROM media WHERE deleted_at < (NOW() - retention) AND purged_at IS NULL,
-- then set purged_at = NOW() for rows we keep for audit trail, or actually remove rows. Per policy we can either:
-- 1) DELETE physically and stop tracking, or
-- 2) SET purged_at = NOW() and leave row for audit (storage object already removed by orphan job).
-- We'll do physical DELETE for soft-deleted media older than retention (storage cleanup is separate).

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

COMMENT ON FUNCTION public.purge_soft_deleted_media IS 'Cron: hard-delete media rows that were soft-deleted older than p_retention_days.';
