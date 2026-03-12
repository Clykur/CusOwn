CREATE TABLE IF NOT EXISTS public.geo_cooldown (
  key TEXT PRIMARY KEY,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT '1970-01-01 00:00:00+00',
  failure_count INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_geo_cooldown_expires_at ON public.geo_cooldown(expires_at);

INSERT INTO public.geo_cooldown (key, expires_at, failure_count)
VALUES ('geo_provider', '1970-01-01 00:00:00+00', 0)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_geo_circuit_status(p_key TEXT DEFAULT 'geo_provider')
RETURNS TABLE(expires_at TIMESTAMPTZ, failure_count INT)
LANGUAGE sql
STABLE
AS $$
  SELECT g.expires_at, g.failure_count
  FROM public.geo_cooldown g
  WHERE g.key = p_key;
$$;

CREATE OR REPLACE FUNCTION public.record_geo_failure(
  p_key TEXT DEFAULT 'geo_provider',
  p_cooldown_seconds INT DEFAULT 60,
  p_threshold INT DEFAULT 3
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.geo_cooldown (key, expires_at, failure_count, updated_at)
  VALUES (p_key, '1970-01-01 00:00:00+00', 1, NOW())
  ON CONFLICT (key) DO UPDATE SET
    failure_count = public.geo_cooldown.failure_count + 1,
    expires_at = CASE
      WHEN public.geo_cooldown.failure_count + 1 >= p_threshold
      THEN NOW() + (p_cooldown_seconds || ' seconds')::INTERVAL
      ELSE public.geo_cooldown.expires_at
    END,
    updated_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.record_geo_success(p_key TEXT DEFAULT 'geo_provider')
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.geo_cooldown (key, expires_at, failure_count, updated_at)
  VALUES (p_key, '1970-01-01 00:00:00+00', 0, NOW())
  ON CONFLICT (key) DO UPDATE SET
    failure_count = 0,
    updated_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_expired_geo_cooldown()
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count BIGINT;
BEGIN
  WITH deleted AS (
    DELETE FROM public.geo_cooldown
    WHERE expires_at < NOW()
    RETURNING key
  )
  SELECT COUNT(*)::BIGINT INTO deleted_count FROM deleted;
  RETURN deleted_count;
END;
$$;
