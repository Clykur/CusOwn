-- Migration: Industry-grade Location System Support
-- 1. Ensure businesses table has detailed location fields
ALTER TABLE public.businesses 
  ADD COLUMN IF NOT EXISTS address_line1 TEXT,
  ADD COLUMN IF NOT EXISTS address_line2 TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS postal_code TEXT,
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(9,6);

-- 2. Add spatial index for businesses
CREATE INDEX IF NOT EXISTS idx_business_location ON public.businesses (latitude, longitude);

-- 3. Create user_locations table for customer tracking
CREATE TABLE IF NOT EXISTS public.user_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  latitude NUMERIC(9,6) NOT NULL,
  longitude NUMERIC(9,6) NOT NULL,
  city TEXT,
  country TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. Add index for user location lookup
CREATE INDEX IF NOT EXISTS idx_user_location_user_id ON public.user_locations (user_id);

-- 5. Enable RLS on user_locations
ALTER TABLE public.user_locations ENABLE ROW LEVEL SECURITY;

-- 6. Add RLS policy: users can only see their own location history
CREATE POLICY "Users can view own location history" ON public.user_locations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own location" ON public.user_locations
  FOR INSERT WITH CHECK (auth.uid() = user_id);
