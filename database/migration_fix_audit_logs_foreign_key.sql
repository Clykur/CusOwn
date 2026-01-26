-- Migration: Fix Audit Logs Foreign Key Constraint
-- Allow NULL admin_user_id for system actions
-- SAFE to run multiple times

-- Step 1: Drop the existing foreign key constraint
DO $$ 
DECLARE
  constraint_name_var TEXT;
BEGIN
  -- Find the foreign key constraint name
  SELECT constraint_name INTO constraint_name_var
  FROM information_schema.table_constraints
  WHERE table_schema = 'public'
    AND table_name = 'audit_logs'
    AND constraint_type = 'FOREIGN KEY'
    AND constraint_name LIKE '%admin_user_id%'
  LIMIT 1;

  -- Drop it if found
  IF constraint_name_var IS NOT NULL THEN
    EXECUTE 'ALTER TABLE audit_logs DROP CONSTRAINT ' || constraint_name_var;
    RAISE NOTICE 'Dropped foreign key constraint: %', constraint_name_var;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Try explicit name
    BEGIN
      ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_admin_user_id_fkey;
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;
END $$;

-- Step 2: Make admin_user_id nullable (if not already)
ALTER TABLE audit_logs 
  ALTER COLUMN admin_user_id DROP NOT NULL;

-- Step 3: Re-add foreign key constraint with NULL allowed
ALTER TABLE audit_logs 
  ADD CONSTRAINT audit_logs_admin_user_id_fkey 
  FOREIGN KEY (admin_user_id) 
  REFERENCES auth.users(id) 
  ON DELETE SET NULL;

-- ============================================
-- VERIFICATION
-- ============================================
-- Run this to verify:
-- SELECT 
--   column_name, 
--   is_nullable, 
--   data_type
-- FROM information_schema.columns
-- WHERE table_name = 'audit_logs' 
--   AND column_name = 'admin_user_id';
--
-- SELECT 
--   constraint_name, 
--   constraint_type
-- FROM information_schema.table_constraints
-- WHERE table_name = 'audit_logs'
--   AND constraint_name LIKE '%admin_user_id%';

-- ============================================
-- NOTES
-- ============================================
-- 1. admin_user_id can now be NULL for system actions
-- 2. Foreign key still enforces referential integrity when user_id is provided
-- 3. System actions (slot transitions, etc.) can use NULL instead of fake UUID
-- 4. Safe to run multiple times (idempotent)
