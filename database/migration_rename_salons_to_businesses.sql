-- Migration: Rename salons table to businesses (generic name for multi-sector support)
-- This migration is SAFE to run - PostgreSQL automatically handles foreign key updates
-- Run this AFTER you've already run migration_complete_setup.sql

-- ============================================
-- PART 1: Rename Table
-- ============================================

-- Rename salons table to businesses
-- PostgreSQL automatically updates all foreign key references
ALTER TABLE salons RENAME TO businesses;

-- ============================================
-- PART 2: Rename Foreign Key Columns
-- ============================================

-- Rename salon_id to business_id in slots table
ALTER TABLE slots RENAME COLUMN salon_id TO business_id;

-- Rename salon_id to business_id in bookings table
ALTER TABLE bookings RENAME COLUMN salon_id TO business_id;

-- ============================================
-- PART 3: Rename Indexes
-- ============================================

-- Rename indexes on businesses table
ALTER INDEX IF EXISTS idx_salons_booking_link RENAME TO idx_businesses_booking_link;
ALTER INDEX IF EXISTS idx_salons_category RENAME TO idx_businesses_category;
ALTER INDEX IF EXISTS idx_salons_category_location RENAME TO idx_businesses_category_location;

-- Rename indexes on slots table
ALTER INDEX IF EXISTS idx_slots_salon_date RENAME TO idx_slots_business_date;
ALTER INDEX IF EXISTS idx_slots_salon_date_status RENAME TO idx_slots_business_date_status;

-- Rename indexes on bookings table
ALTER INDEX IF EXISTS idx_bookings_salon RENAME TO idx_bookings_business;

-- ============================================
-- VERIFICATION QUERIES (Optional - run to verify)
-- ============================================

-- Check table exists with new name
-- SELECT table_name FROM information_schema.tables WHERE table_name = 'businesses';

-- Check columns renamed correctly
-- SELECT column_name FROM information_schema.columns 
-- WHERE table_name = 'slots' AND column_name = 'business_id';
-- SELECT column_name FROM information_schema.columns 
-- WHERE table_name = 'bookings' AND column_name = 'business_id';

-- Check indexes renamed
-- SELECT indexname FROM pg_indexes WHERE tablename = 'businesses';
-- SELECT indexname FROM pg_indexes WHERE tablename = 'slots' AND indexname LIKE '%business%';
-- SELECT indexname FROM pg_indexes WHERE tablename = 'bookings' AND indexname LIKE '%business%';

-- ============================================
-- ROLLBACK (if needed - use with caution)
-- ============================================

-- To rollback the rename:
-- ALTER TABLE businesses RENAME TO salons;
-- ALTER TABLE slots RENAME COLUMN business_id TO salon_id;
-- ALTER TABLE bookings RENAME COLUMN business_id TO salon_id;
-- ALTER INDEX IF EXISTS idx_businesses_booking_link RENAME TO idx_salons_booking_link;
-- ALTER INDEX IF EXISTS idx_businesses_category RENAME TO idx_salons_category;
-- ALTER INDEX IF EXISTS idx_businesses_category_location RENAME TO idx_salons_category_location;
-- ALTER INDEX IF EXISTS idx_slots_business_date RENAME TO idx_slots_salon_date;
-- ALTER INDEX IF EXISTS idx_slots_business_date_status RENAME TO idx_slots_salon_date_status;
-- ALTER INDEX IF EXISTS idx_bookings_business RENAME TO idx_bookings_salon;

