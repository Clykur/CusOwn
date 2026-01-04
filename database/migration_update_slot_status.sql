-- Migration: Update slot status constraint to include 'reserved'
-- This updates the existing slots table to support the reserved status
-- Run this if your database was created with the old schema that only had 'available' and 'booked'

-- Drop the existing constraint
ALTER TABLE slots DROP CONSTRAINT IF EXISTS slots_status_check;

-- Add new constraint with 'reserved' status included
ALTER TABLE slots ADD CONSTRAINT slots_status_check 
  CHECK (status IN ('available', 'reserved', 'booked'));

-- Note: If you haven't run the reservation migration yet, also run:
-- database/migration_add_slot_reservation.sql

