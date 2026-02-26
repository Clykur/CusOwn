-- Run separately: ensure media_security_log RLS policy exists without error if already present.
-- Idempotent: drop then create.

DROP POLICY IF EXISTS "Service role only for media_security_log" ON public.media_security_log;

CREATE POLICY "Service role only for media_security_log"
  ON public.media_security_log FOR ALL USING (false);
