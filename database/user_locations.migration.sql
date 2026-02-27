-- user_locations: persist resolved user location (GPS or IP) for 7-day freshness; avoid calling BigDataCloud on every request.
-- Optional: enable PostGIS for businesses distance search (run after extension is enabled in Supabase dashboard if needed).

CREATE TABLE IF NOT EXISTS public.user_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  city TEXT,
  region TEXT,
  country_code TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL CHECK (source IN ('gps', 'ip')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_locations_user_id ON public.user_locations (user_id);
CREATE INDEX IF NOT EXISTS idx_user_locations_detected_at ON public.user_locations (detected_at DESC);

COMMENT ON TABLE public.user_locations IS 'Resolved user location (GPS or IP); used to avoid calling external geo API on every request when location is fresh (< 7 days).';

-- RLS: users can read/insert/update their own rows only
ALTER TABLE public.user_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own user_locations" ON public.user_locations;
CREATE POLICY "Users can read own user_locations" ON public.user_locations
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own user_locations" ON public.user_locations;
CREATE POLICY "Users can insert own user_locations" ON public.user_locations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own user_locations" ON public.user_locations;
CREATE POLICY "Users can update own user_locations" ON public.user_locations
  FOR UPDATE USING (auth.uid() = user_id);

-- Service role can read/write for API (server-side)
DROP POLICY IF EXISTS "Service role full access user_locations" ON public.user_locations;
CREATE POLICY "Service role full access user_locations" ON public.user_locations
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Optional PostGIS for businesses: only run if PostGIS extension is enabled (e.g. in Supabase: Database → Extensions → postgis).
-- Adds geography column and index for ORDER BY distance. Businesses already have latitude, longitude; this adds a computed geography for native distance sort.
/*
CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS location_geo geography(POINT, 4326);
CREATE INDEX IF NOT EXISTS idx_businesses_location_geo ON public.businesses USING GIST (location_geo);

-- Backfill and keep in sync via trigger or application
UPDATE public.businesses SET location_geo = ST_SetSRID(ST_MakePoint(longitude::float, latitude::float), 4326)::geography WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
*/
