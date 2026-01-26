CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(business_id, name)
);

CREATE TABLE IF NOT EXISTS booking_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(booking_id, service_id)
);

ALTER TABLE bookings 
  ADD COLUMN IF NOT EXISTS total_duration_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS total_price_cents INTEGER,
  ADD COLUMN IF NOT EXISTS services_count INTEGER DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_services_business ON services(business_id);
CREATE INDEX IF NOT EXISTS idx_services_active ON services(business_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_booking_services_booking ON booking_services(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_services_service ON booking_services(service_id);
