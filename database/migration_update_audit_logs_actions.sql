-- Migration: Update Audit Logs Action Types
-- Add new action types for booking mutations
-- SAFE to run multiple times

-- Step 1: Find and drop the existing constraint
DO $$ 
DECLARE
  constraint_name_var TEXT;
BEGIN
  -- Find the constraint name (PostgreSQL auto-generates names)
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

-- Step 2: Add the updated constraint with all action types
ALTER TABLE audit_logs 
  ADD CONSTRAINT audit_logs_action_type_check 
  CHECK (action_type IN (
    'business_created',
    'business_updated',
    'business_deleted',
    'business_suspended',
    'user_created',
    'user_updated',
    'user_deleted',
    'booking_created',
    'booking_updated',
    'booking_confirmed',
    'booking_rejected',
    'booking_cancelled',
    'booking_rescheduled',
    'booking_no_show',
    'notification_sent',
    'data_corrected',
    'system_config_changed'
  ));

-- ============================================
-- VERIFICATION (Optional - run to check)
-- ============================================
-- SELECT constraint_name, constraint_type
-- FROM information_schema.table_constraints
-- WHERE table_name = 'audit_logs'
--   AND constraint_type = 'CHECK';

-- ============================================
-- NOTES
-- ============================================
-- 1. This migration is safe to run multiple times
-- 2. admin_user_id field name is kept for backward compatibility
-- 3. Field now stores any user_id (not just admin) for all mutations
-- 4. All new booking action types are now supported
