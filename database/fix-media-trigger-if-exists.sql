-- Run separately: ensure media trigger exists without error if already present.
-- Idempotent: drop then create.

DROP TRIGGER IF EXISTS update_media_updated_at ON public.media;

CREATE TRIGGER update_media_updated_at
  BEFORE UPDATE ON public.media
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
