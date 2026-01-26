ALTER TABLE businesses 
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS area TEXT,
  ADD COLUMN IF NOT EXISTS pincode TEXT,
  ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
  ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8),
  ADD COLUMN IF NOT EXISTS search_radius_km INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS is_location_verified BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_businesses_city_area 
  ON businesses(city, area) WHERE city IS NOT NULL AND area IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_businesses_pincode 
  ON businesses(pincode) WHERE pincode IS NOT NULL;
