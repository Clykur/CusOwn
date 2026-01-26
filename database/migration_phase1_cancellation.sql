-- Migration: Phase 1 - Booking Cancellation Support
-- Adds cancellation tracking fields to bookings table

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancelled_by TEXT CHECK (cancelled_by IN ('customer', 'owner', 'system'));
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_bookings_cancelled_by ON bookings(cancelled_by) WHERE cancelled_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_cancelled_at ON bookings(cancelled_at) WHERE cancelled_at IS NOT NULL;
