-- Migration: Phase 1 - Business Downtime Management
-- Creates tables for holidays, closures, and special hours

CREATE TABLE IF NOT EXISTS business_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  holiday_date DATE NOT NULL,
  holiday_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(business_id, holiday_date)
);

CREATE TABLE IF NOT EXISTS business_closures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CHECK (end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS business_special_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  opening_time TIME,
  closing_time TIME,
  is_closed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(business_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_business_holidays_business_date ON business_holidays(business_id, holiday_date);
CREATE INDEX IF NOT EXISTS idx_business_closures_business_dates ON business_closures(business_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_business_special_hours_business_day ON business_special_hours(business_id, day_of_week);

CREATE TRIGGER update_business_closures_updated_at BEFORE UPDATE ON business_closures
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_business_special_hours_updated_at BEFORE UPDATE ON business_special_hours
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
