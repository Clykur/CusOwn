-- Migration: Add Soft Delete Support for User Accounts and Businesses
-- This allows users to delete their accounts while keeping data for 30 days for admin/recovery purposes
-- After 30 days, a cleanup job can permanently delete the records

-- ============================================
-- PART 1: Add soft delete columns to user_profiles
-- ============================================

-- Add deleted_at column to user_profiles (null = not deleted)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add scheduled permanent deletion timestamp
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS permanent_deletion_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add deletion reason for audit purposes
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS deletion_reason TEXT DEFAULT NULL;

-- Create index for filtering deleted records
CREATE INDEX IF NOT EXISTS idx_user_profiles_deleted_at ON user_profiles(deleted_at) WHERE deleted_at IS NOT NULL;

-- Create index for cleanup job to find records ready for permanent deletion
CREATE INDEX IF NOT EXISTS idx_user_profiles_permanent_deletion ON user_profiles(permanent_deletion_at) WHERE permanent_deletion_at IS NOT NULL;

-- ============================================
-- PART 2: Add soft delete columns to businesses
-- ============================================

-- Add deleted_at column to businesses (null = not deleted)
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add scheduled permanent deletion timestamp
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS permanent_deletion_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add deletion reason for audit purposes
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS deletion_reason TEXT DEFAULT NULL;

-- Create index for filtering deleted records
CREATE INDEX IF NOT EXISTS idx_businesses_deleted_at ON businesses(deleted_at) WHERE deleted_at IS NOT NULL;

-- Create index for cleanup job
CREATE INDEX IF NOT EXISTS idx_businesses_permanent_deletion ON businesses(permanent_deletion_at) WHERE permanent_deletion_at IS NOT NULL;

-- ============================================
-- PART 3: Create function to soft delete user and their businesses
-- ============================================

CREATE OR REPLACE FUNCTION soft_delete_user_account(
  p_user_id UUID,
  p_reason TEXT DEFAULT 'User requested account deletion'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_at TIMESTAMP WITH TIME ZONE := NOW();
  v_permanent_deletion_at TIMESTAMP WITH TIME ZONE := NOW() + INTERVAL '30 days';
  v_business_count INTEGER;
  v_result JSONB;
BEGIN
  -- Soft delete user profile
  UPDATE user_profiles
  SET 
    deleted_at = v_deleted_at,
    permanent_deletion_at = v_permanent_deletion_at,
    deletion_reason = p_reason,
    updated_at = v_deleted_at
  WHERE id = p_user_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found or already deleted';
  END IF;

  -- Soft delete all businesses owned by user
  UPDATE businesses
  SET 
    deleted_at = v_deleted_at,
    permanent_deletion_at = v_permanent_deletion_at,
    deletion_reason = 'Owner account deleted: ' || p_reason,
    updated_at = v_deleted_at
  WHERE owner_user_id = p_user_id
    AND deleted_at IS NULL;

  GET DIAGNOSTICS v_business_count = ROW_COUNT;

  v_result := jsonb_build_object(
    'user_id', p_user_id,
    'deleted_at', v_deleted_at,
    'permanent_deletion_at', v_permanent_deletion_at,
    'businesses_deleted', v_business_count
  );

  RETURN v_result;
END;
$$;

-- ============================================
-- PART 4: Create function to permanently delete expired records
-- This should be called by a scheduled job (e.g., daily cron)
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_expired_soft_deleted_records()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_users_deleted INTEGER := 0;
  v_businesses_deleted INTEGER := 0;
  v_result JSONB;
BEGIN
  -- Delete businesses that are past their permanent deletion date
  -- (Bookings and slots will cascade due to ON DELETE CASCADE)
  DELETE FROM businesses
  WHERE permanent_deletion_at IS NOT NULL
    AND permanent_deletion_at <= NOW();

  GET DIAGNOSTICS v_businesses_deleted = ROW_COUNT;

  -- Delete user profiles that are past their permanent deletion date
  -- Note: Auth.users deletion should be handled separately via Supabase Admin API
  -- This just cleans up the profile data
  DELETE FROM user_profiles
  WHERE permanent_deletion_at IS NOT NULL
    AND permanent_deletion_at <= NOW();

  GET DIAGNOSTICS v_users_deleted = ROW_COUNT;

  v_result := jsonb_build_object(
    'cleanup_time', NOW(),
    'users_deleted', v_users_deleted,
    'businesses_deleted', v_businesses_deleted
  );

  RETURN v_result;
END;
$$;

-- ============================================
-- PART 5: Create function to restore (undo) soft deleted user
-- Admin-only function to restore deleted accounts within 30 days
-- ============================================

CREATE OR REPLACE FUNCTION restore_deleted_user_account(
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_restored_at TIMESTAMP WITH TIME ZONE := NOW();
  v_business_count INTEGER;
  v_result JSONB;
BEGIN
  -- Check if user is soft-deleted and not yet permanently deleted
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE id = p_user_id 
      AND deleted_at IS NOT NULL 
      AND permanent_deletion_at > NOW()
  ) THEN
    RAISE EXCEPTION 'User not found, not deleted, or past recovery period';
  END IF;

  -- Restore user profile
  UPDATE user_profiles
  SET 
    deleted_at = NULL,
    permanent_deletion_at = NULL,
    deletion_reason = NULL,
    updated_at = v_restored_at
  WHERE id = p_user_id;

  -- Restore all businesses owned by user
  UPDATE businesses
  SET 
    deleted_at = NULL,
    permanent_deletion_at = NULL,
    deletion_reason = NULL,
    updated_at = v_restored_at
  WHERE owner_user_id = p_user_id
    AND deleted_at IS NOT NULL;

  GET DIAGNOSTICS v_business_count = ROW_COUNT;

  v_result := jsonb_build_object(
    'user_id', p_user_id,
    'restored_at', v_restored_at,
    'businesses_restored', v_business_count
  );

  RETURN v_result;
END;
$$;

-- ============================================
-- PART 6: Update RLS policies to filter out deleted records for non-admins
-- ============================================

-- Drop existing policies we're going to replace
DROP POLICY IF EXISTS "Public can view non-suspended businesses" ON businesses;
DROP POLICY IF EXISTS "Owners can view own businesses" ON businesses;
DROP POLICY IF EXISTS "Admins can view all businesses" ON businesses;

-- Create new policies that filter deleted records for non-admins

-- Public view: exclude both suspended and deleted businesses
CREATE POLICY "Public can view active businesses" ON businesses
  FOR SELECT USING (
    deleted_at IS NULL 
    AND (suspended IS NULL OR suspended = false)
  );

-- Owners can view their own businesses (including suspended, but not deleted)
CREATE POLICY "Owners can view own active businesses" ON businesses
  FOR SELECT USING (
    owner_user_id = auth.uid() 
    AND deleted_at IS NULL
  );

-- Admins can view ALL businesses including deleted ones
CREATE POLICY "Admins can view all businesses including deleted" ON businesses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() 
      AND user_type = 'admin'
    )
  );

-- Update user_profiles policies for soft delete
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;

-- Users can view their own profile (even if soft-deleted, for showing deletion status)
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

-- Admins can view all profiles including deleted
CREATE POLICY "Admins can view all profiles including deleted" ON user_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() 
      AND user_type = 'admin'
    )
  );

-- ============================================
-- PART 7: Grant execute permissions on functions
-- ============================================

-- Allow authenticated users to soft delete their own account
GRANT EXECUTE ON FUNCTION soft_delete_user_account(UUID, TEXT) TO authenticated;

-- Only service role should run cleanup (via cron/scheduled job)
REVOKE ALL ON FUNCTION cleanup_expired_soft_deleted_records() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cleanup_expired_soft_deleted_records() TO service_role;

-- Only service role (admin API) should restore accounts
REVOKE ALL ON FUNCTION restore_deleted_user_account(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION restore_deleted_user_account(UUID) TO service_role;

COMMENT ON FUNCTION soft_delete_user_account IS 'Soft deletes a user account and all associated businesses. Data is retained for 30 days.';
COMMENT ON FUNCTION cleanup_expired_soft_deleted_records IS 'Permanently deletes records that have passed their 30-day retention period. Should be run by a scheduled job.';
COMMENT ON FUNCTION restore_deleted_user_account IS 'Admin function to restore a soft-deleted user account within the 30-day retention period.';
