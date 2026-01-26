-- QUICK FIX: Update Audit Logs Action Types (Simplified Version)
-- If the other migration fails, try this simpler version

-- Option 1: Try dropping by explicit name (if you know it)
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_type_check;

-- Option 2: If that doesn't work, find and drop the constraint
DO $$ 
DECLARE
  constraint_name_var TEXT;
BEGIN
  -- Find any CHECK constraint on audit_logs table
  SELECT constraint_name INTO constraint_name_var
  FROM information_schema.table_constraints
  WHERE table_schema = 'public'
    AND table_name = 'audit_logs'
    AND constraint_type = 'CHECK'
  LIMIT 1;

  -- Drop it if found
  IF constraint_name_var IS NOT NULL THEN
    EXECUTE 'ALTER TABLE audit_logs DROP CONSTRAINT ' || constraint_name_var;
    RAISE NOTICE 'Dropped constraint: %', constraint_name_var;
  ELSE
    RAISE NOTICE 'No CHECK constraint found on audit_logs';
  END IF;
END $$;

-- Step 3: Add the new constraint
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

-- Verify it worked
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'audit_logs_action_type_check';
