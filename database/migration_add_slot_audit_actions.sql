-- Migration: Add Slot Audit Actions
-- Add slot-related action types to audit_logs constraint
-- SAFE to run multiple times

-- Step 1: Find and drop the existing constraint
DO $$ 
DECLARE
  constraint_name_var TEXT;
BEGIN
  -- Find the constraint name
  SELECT constraint_name INTO constraint_name_var
  FROM information_schema.table_constraints
  WHERE table_schema = 'public'
    AND table_name = 'audit_logs'
    AND constraint_type = 'CHECK'
    AND constraint_name LIKE '%action_type%'
  LIMIT 1;

  -- Drop it if found
  IF constraint_name_var IS NOT NULL THEN
    EXECUTE 'ALTER TABLE audit_logs DROP CONSTRAINT ' || constraint_name_var;
    RAISE NOTICE 'Dropped constraint: %', constraint_name_var;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- If anything fails, try the explicit name
    BEGIN
      ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_type_check;
    EXCEPTION
      WHEN OTHERS THEN
        NULL; -- Ignore if constraint doesn't exist
    END;
END $$;

-- Step 2: Add the updated constraint with slot actions included
ALTER TABLE audit_logs 
  ADD CONSTRAINT audit_logs_action_type_check 
  CHECK (action_type IN (
    -- Business actions
    'business_created',
    'business_updated',
    'business_deleted',
    'business_suspended',
    -- User actions
    'user_created',
    'user_updated',
    'user_deleted',
    -- Booking actions
    'booking_created',
    'booking_updated',
    'booking_confirmed',
    'booking_rejected',
    'booking_cancelled',
    'booking_rescheduled',
    'booking_no_show',
    -- Slot actions (NEW)
    'slot_reserved',
    'slot_released',
    'slot_booked',
    -- System actions
    'notification_sent',
    'data_corrected',
    'system_config_changed'
  ));

-- Step 3: Update entity_type constraint to include 'slot' if needed
DO $$
BEGIN
  -- Check if entity_type constraint exists and includes 'slot'
  IF EXISTS (
    SELECT 1 
    FROM information_schema.check_constraints 
    WHERE constraint_name LIKE '%entity_type%'
      AND check_clause NOT LIKE '%slot%'
  ) THEN
    -- Find and drop the entity_type constraint
    DECLARE
      entity_constraint_name TEXT;
    BEGIN
      SELECT constraint_name INTO entity_constraint_name
      FROM information_schema.table_constraints
      WHERE table_schema = 'public'
        AND table_name = 'audit_logs'
        AND constraint_type = 'CHECK'
        AND constraint_name LIKE '%entity_type%'
      LIMIT 1;

      IF entity_constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE audit_logs DROP CONSTRAINT ' || entity_constraint_name;
        RAISE NOTICE 'Dropped entity_type constraint: %', entity_constraint_name;
      END IF;
    END;

    -- Add updated constraint with 'slot' included
    ALTER TABLE audit_logs 
      ADD CONSTRAINT audit_logs_entity_type_check 
      CHECK (entity_type IN ('business', 'user', 'booking', 'system', 'slot'));
      
    RAISE NOTICE 'Updated entity_type constraint to include slot';
  ELSE
    RAISE NOTICE 'Entity type constraint already includes slot or does not exist';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error updating entity_type constraint: %', SQLERRM;
END $$;

-- ============================================
-- VERIFICATION
-- ============================================
-- Run these to verify:
-- SELECT constraint_name, check_clause
-- FROM information_schema.check_constraints
-- WHERE constraint_name LIKE '%audit_logs%action_type%';
--
-- SELECT constraint_name, check_clause
-- FROM information_schema.check_constraints
-- WHERE constraint_name LIKE '%audit_logs%entity_type%';

-- Step 4: Fix admin_user_id foreign key to allow NULL for system actions
DO $$ 
DECLARE
  fk_constraint_name TEXT;
BEGIN
  -- Find the foreign key constraint
  SELECT constraint_name INTO fk_constraint_name
  FROM information_schema.table_constraints
  WHERE table_schema = 'public'
    AND table_name = 'audit_logs'
    AND constraint_type = 'FOREIGN KEY'
    AND constraint_name LIKE '%admin_user_id%'
  LIMIT 1;

  -- Drop it if found
  IF fk_constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE audit_logs DROP CONSTRAINT ' || fk_constraint_name;
    RAISE NOTICE 'Dropped foreign key constraint: %', fk_constraint_name;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    BEGIN
      ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_admin_user_id_fkey;
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;
END $$;

-- Make admin_user_id nullable if not already
ALTER TABLE audit_logs 
  ALTER COLUMN admin_user_id DROP NOT NULL;

-- Re-add foreign key constraint allowing NULL
ALTER TABLE audit_logs 
  ADD CONSTRAINT audit_logs_admin_user_id_fkey 
  FOREIGN KEY (admin_user_id) 
  REFERENCES auth.users(id) 
  ON DELETE SET NULL;

-- ============================================
-- NOTES
-- ============================================
-- 1. This migration adds slot-related audit actions
-- 2. Safe to run multiple times (idempotent)
-- 3. Slot actions: slot_reserved, slot_released, slot_booked
-- 4. Entity type 'slot' is now allowed in audit_logs
-- 5. admin_user_id can now be NULL for system actions (no foreign key violation)
