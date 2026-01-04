-- Migration: Add slot reservation system
-- This adds reserved_until column and updates slot status to support reservations

-- Add reserved_until column to slots table
ALTER TABLE slots ADD COLUMN IF NOT EXISTS reserved_until TIMESTAMP WITH TIME ZONE;

-- Update slot status check constraint to include 'reserved' status
-- First, drop the existing constraint
ALTER TABLE slots DROP CONSTRAINT IF EXISTS slots_status_check;

-- Add new constraint with 'reserved' status
ALTER TABLE slots ADD CONSTRAINT slots_status_check 
  CHECK (status IN ('available', 'reserved', 'booked'));

-- Add index for efficient reservation queries
CREATE INDEX IF NOT EXISTS idx_slots_reserved_until ON slots(reserved_until) 
  WHERE reserved_until IS NOT NULL;

-- Add composite index for date and status queries
CREATE INDEX IF NOT EXISTS idx_slots_date_status ON slots(date, status);

-- Add index for salon, date, and status (common query pattern)
CREATE INDEX IF NOT EXISTS idx_slots_salon_date_status ON slots(salon_id, date, status);

