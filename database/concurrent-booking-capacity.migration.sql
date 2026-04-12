-- Concurrent booking capacity (multi-chair): max overlapping appointments per business.
-- Default 1 preserves legacy single-resource behavior.

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS concurrent_booking_capacity INTEGER NOT NULL DEFAULT 1
    CHECK (concurrent_booking_capacity >= 1 AND concurrent_booking_capacity <= 100);

COMMENT ON COLUMN businesses.concurrent_booking_capacity IS
  'Max overlapping bookings (chairs/stations). Availability uses sweep-line over booking time ranges.';
