-- Optional: PostGIS for businesses distance search. Enable the "postgis" extension in Supabase first (Database → Extensions).
-- Then run this migration. Business search can then use: ORDER BY location_geo <-> ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography

CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS location_geo geography(POINT, 4326);
CREATE INDEX IF NOT EXISTS idx_businesses_location_geo ON public.businesses USING GIST (location_geo);

-- Backfill from existing latitude/longitude
UPDATE public.businesses
SET location_geo = ST_SetSRID(ST_MakePoint(longitude::float, latitude::float), 4326)::geography
WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND location_geo IS NULL;

COMMENT ON COLUMN public.businesses.location_geo IS 'PostGIS point for distance search; synced from latitude/longitude.';
