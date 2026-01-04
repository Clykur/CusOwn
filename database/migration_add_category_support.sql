-- Migration: Add category/sector support for multi-sector scaling
-- This migration is SAFE to run - it won't break existing data
-- Run this to enable support for multiple business sectors (salons, restaurants, clinics, etc.)

-- Step 1: Add category column with default value (existing salons will get 'salon' category)
ALTER TABLE salons ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'salon';

-- Step 2: Add index for efficient category filtering
CREATE INDEX IF NOT EXISTS idx_salons_category ON salons(category);

-- Step 3: Add composite index for category + location (common query pattern)
CREATE INDEX IF NOT EXISTS idx_salons_category_location ON salons(category, location) 
  WHERE location IS NOT NULL;

-- Step 4: Update existing records to have 'salon' category (safety check)
UPDATE salons 
SET category = 'salon' 
WHERE category IS NULL;

-- Step 5: Make category NOT NULL after setting defaults (optional, for data integrity)
-- Uncomment the line below if you want to enforce category requirement for new records
-- ALTER TABLE salons ALTER COLUMN category SET NOT NULL;

-- Verification query (run this to check the migration):
-- SELECT category, COUNT(*) as count FROM salons GROUP BY category;

