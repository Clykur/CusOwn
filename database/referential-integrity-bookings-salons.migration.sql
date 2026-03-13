-- Migration: Referential Integrity for Bookings → Businesses (salons)
-- Purpose: Prevent orphaned bookings by enforcing FK constraint with CASCADE DELETE
-- 
-- Context: The original 'salons' table was renamed to 'businesses' for multi-sector support.
-- This migration ensures referential integrity regardless of which name is active.
--
-- This migration:
-- 1. Detects the actual table name (businesses or salons)
-- 2. Cleans up any existing orphaned bookings
-- 3. Adds/verifies foreign key constraint with ON DELETE CASCADE
-- 4. Ensures future business/salon deletions automatically remove associated bookings

BEGIN;

-- Step 1: Detect table name and clean up orphaned bookings
DO $$
DECLARE
  business_table_name TEXT;
  orphan_count INTEGER;
  has_fk BOOLEAN;
BEGIN
  -- Determine if table is named 'businesses' or 'salons'
  SELECT table_name INTO business_table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN ('businesses', 'salons')
  LIMIT 1;

  IF business_table_name IS NULL THEN
    RAISE EXCEPTION 'Neither businesses nor salons table found!';
  END IF;

  RAISE NOTICE 'Using table: %', business_table_name;

  -- Count orphaned bookings
  IF business_table_name = 'businesses' THEN
    SELECT COUNT(*) INTO orphan_count
    FROM bookings b
    WHERE NOT EXISTS (SELECT 1 FROM businesses s WHERE s.id = b.business_id);
  ELSE
    SELECT COUNT(*) INTO orphan_count
    FROM bookings b
    WHERE NOT EXISTS (SELECT 1 FROM salons s WHERE s.id = b.business_id);
  END IF;

  IF orphan_count > 0 THEN
    RAISE NOTICE 'Found % orphaned booking(s). Cleaning up...', orphan_count;
  ELSE
    RAISE NOTICE 'No orphaned bookings found.';
  END IF;

  -- Delete orphaned bookings
  IF business_table_name = 'businesses' THEN
    DELETE FROM bookings
    WHERE business_id NOT IN (SELECT id FROM businesses);
  ELSE
    DELETE FROM bookings
    WHERE business_id NOT IN (SELECT id FROM salons);
  END IF;

  -- Check if any FK constraint already exists for business_id
  SELECT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'bookings'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'business_id'
  ) INTO has_fk;

  IF has_fk THEN
    RAISE NOTICE 'Foreign key constraint on bookings.business_id already exists.';
  ELSE
    -- Add FK constraint (dynamic SQL needed for table name)
    IF business_table_name = 'businesses' THEN
      EXECUTE 'ALTER TABLE bookings
        ADD CONSTRAINT fk_bookings_business_id
        FOREIGN KEY (business_id) REFERENCES businesses(id)
        ON DELETE CASCADE';
    ELSE
      EXECUTE 'ALTER TABLE bookings
        ADD CONSTRAINT fk_bookings_business_id
        FOREIGN KEY (business_id) REFERENCES salons(id)
        ON DELETE CASCADE';
    END IF;
    RAISE NOTICE 'Foreign key constraint fk_bookings_business_id added successfully.';
  END IF;
END $$;

-- Step 2: Create index on business_id for efficient FK lookups (if not exists)
CREATE INDEX IF NOT EXISTS idx_bookings_business_id_fk
ON bookings(business_id);

-- Step 3: Also ensure slots table has proper FK (should already exist from schema)
DO $$
DECLARE
  business_table_name TEXT;
  has_slots_fk BOOLEAN;
BEGIN
  SELECT table_name INTO business_table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN ('businesses', 'salons')
  LIMIT 1;

  -- Check if FK exists for slots.business_id
  SELECT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'slots'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'business_id'
  ) INTO has_slots_fk;

  IF has_slots_fk THEN
    RAISE NOTICE 'Foreign key constraint on slots.business_id already exists.';
  ELSE
    IF business_table_name = 'businesses' THEN
      EXECUTE 'ALTER TABLE slots
        ADD CONSTRAINT fk_slots_business_id
        FOREIGN KEY (business_id) REFERENCES businesses(id)
        ON DELETE CASCADE';
    ELSE
      EXECUTE 'ALTER TABLE slots
        ADD CONSTRAINT fk_slots_business_id
        FOREIGN KEY (business_id) REFERENCES salons(id)
        ON DELETE CASCADE';
    END IF;
    RAISE NOTICE 'Foreign key constraint fk_slots_business_id added to slots table.';
  END IF;
END $$;

COMMIT;

-- ============================================
-- VERIFICATION QUERIES (run manually)
-- ============================================

-- Check all FK constraints on bookings table:
-- SELECT
--   tc.constraint_name,
--   tc.table_name,
--   kcu.column_name,
--   ccu.table_name AS foreign_table_name,
--   ccu.column_name AS foreign_column_name,
--   rc.delete_rule
-- FROM information_schema.table_constraints AS tc
-- JOIN information_schema.key_column_usage AS kcu
--   ON tc.constraint_name = kcu.constraint_name
-- JOIN information_schema.constraint_column_usage AS ccu
--   ON ccu.constraint_name = tc.constraint_name
-- JOIN information_schema.referential_constraints AS rc
--   ON rc.constraint_name = tc.constraint_name
-- WHERE tc.constraint_type = 'FOREIGN KEY'
--   AND tc.table_name IN ('bookings', 'slots');

-- Check for any remaining orphaned bookings (should be 0):
-- SELECT COUNT(*) FROM bookings b
-- WHERE NOT EXISTS (SELECT 1 FROM businesses s WHERE s.id = b.business_id);
