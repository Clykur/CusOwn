-- Migration: Future-proof rename to generic terms (OPTIONAL - for later)
-- This is a FUTURE migration - only run when you're ready to rename everything
-- This will NOT break existing functionality, but requires code updates
-- 
-- IMPORTANT: Only run this after updating your codebase to use 'business' instead of 'salon'
-- This migration is provided for future reference, not for immediate use

-- Step 1: Rename table (PostgreSQL handles foreign key updates automatically)
-- ALTER TABLE salons RENAME TO businesses;

-- Step 2: Rename foreign key columns in related tables
-- ALTER TABLE slots RENAME COLUMN salon_id TO business_id;
-- ALTER TABLE bookings RENAME COLUMN salon_id TO business_id;

-- Step 3: Rename indexes
-- ALTER INDEX idx_salons_booking_link RENAME TO idx_businesses_booking_link;
-- ALTER INDEX idx_salons_category RENAME TO idx_businesses_category;
-- ALTER INDEX idx_salons_category_location RENAME TO idx_businesses_category_location;
-- ALTER INDEX idx_slots_salon_date RENAME TO idx_slots_business_date;
-- ALTER INDEX idx_bookings_salon RENAME TO idx_bookings_business;

-- Step 4: Update foreign key constraint names (if needed)
-- This is usually handled automatically, but verify with:
-- SELECT constraint_name FROM information_schema.table_constraints 
-- WHERE table_name = 'slots' AND constraint_type = 'FOREIGN KEY';

-- Note: After running this, you'll need to update:
-- 1. All TypeScript types (Salon -> Business)
-- 2. All service names (SalonService -> BusinessService)
-- 3. All API routes (/api/salons -> /api/businesses)
-- 4. All frontend components

