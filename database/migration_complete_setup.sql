-- Complete Migration Script: Safe setup for multi-sector support
-- This combines all necessary migrations in the correct order
-- SAFE to run multiple times (uses IF NOT EXISTS / IF EXISTS)

-- ============================================
-- PART 1: Slot Reservation System
-- ============================================

-- Add reserved_until column to slots table
ALTER TABLE slots ADD COLUMN IF NOT EXISTS reserved_until TIMESTAMP WITH TIME ZONE;

-- Update slot status check constraint to include 'reserved' status
ALTER TABLE slots DROP CONSTRAINT IF EXISTS slots_status_check;
ALTER TABLE slots ADD CONSTRAINT slots_status_check 
  CHECK (status IN ('available', 'reserved', 'booked'));

-- Add indexes for efficient reservation queries
CREATE INDEX IF NOT EXISTS idx_slots_reserved_until ON slots(reserved_until) 
  WHERE reserved_until IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_slots_date_status ON slots(date, status);

CREATE INDEX IF NOT EXISTS idx_slots_salon_date_status ON slots(salon_id, date, status);

-- ============================================
-- PART 2: Category/Sector Support
-- ============================================

-- Add category column with default value
ALTER TABLE salons ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'salon';

-- Add indexes for category filtering
CREATE INDEX IF NOT EXISTS idx_salons_category ON salons(category);

CREATE INDEX IF NOT EXISTS idx_salons_category_location ON salons(category, location) 
  WHERE location IS NOT NULL;

-- Update existing records to have 'salon' category (safety check)
UPDATE salons 
SET category = 'salon' 
WHERE category IS NULL;

-- ============================================
-- VERIFICATION QUERIES (Optional - run to verify)
-- ============================================

-- Check slot status constraint
-- SELECT constraint_name, check_clause 
-- FROM information_schema.check_constraints 
-- WHERE constraint_name = 'slots_status_check';

-- Check category distribution
-- SELECT category, COUNT(*) as count FROM salons GROUP BY category;

-- Check indexes
-- SELECT indexname FROM pg_indexes WHERE tablename = 'salons' AND indexname LIKE '%category%';
-- SELECT indexname FROM pg_indexes WHERE tablename = 'slots' AND indexname LIKE '%reserved%';

-- ============================================
-- ROLLBACK (if needed - use with caution)
-- ============================================

-- To rollback category support:
-- ALTER TABLE salons DROP COLUMN IF EXISTS category;
-- DROP INDEX IF EXISTS idx_salons_category;
-- DROP INDEX IF EXISTS idx_salons_category_location;

-- To rollback reservation system:
-- ALTER TABLE slots DROP COLUMN IF EXISTS reserved_until;
-- ALTER TABLE slots DROP CONSTRAINT IF EXISTS slots_status_check;
-- ALTER TABLE slots ADD CONSTRAINT slots_status_check 
--   CHECK (status IN ('available', 'booked'));
-- DROP INDEX IF EXISTS idx_slots_reserved_until;
-- DROP INDEX IF EXISTS idx_slots_date_status;
-- DROP INDEX IF EXISTS idx_slots_salon_date_status;

