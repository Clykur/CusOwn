-- Migration: Add Admin Support
-- This migration adds 'admin' to the user_type enum and sets up admin functionality
-- SAFE to run - won't break existing data

-- ============================================
-- PART 1: Update user_type CHECK constraint to include 'admin'
-- ============================================

-- Drop the existing constraint
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_user_type_check;

-- Add new constraint with 'admin' included
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_user_type_check 
  CHECK (user_type IN ('owner', 'customer', 'both', 'admin'));

-- ============================================
-- PART 2: Set specific user as admin
-- ============================================

-- Update the user with email chinnuk0521@gmail.com to admin
-- First, find the user ID from auth.users
UPDATE user_profiles
SET user_type = 'admin',
    updated_at = NOW()
WHERE id = (
  SELECT id 
  FROM auth.users 
  WHERE email = 'chinnuk0521@gmail.com'
);

-- If user profile doesn't exist yet, create it
INSERT INTO user_profiles (id, user_type, full_name, created_at, updated_at)
SELECT 
  id,
  'admin',
  COALESCE(raw_user_meta_data->>'full_name', email),
  NOW(),
  NOW()
FROM auth.users
WHERE email = 'chinnuk0521@gmail.com'
  AND id NOT IN (SELECT id FROM user_profiles)
ON CONFLICT (id) DO UPDATE
SET user_type = 'admin',
    updated_at = NOW();

-- ============================================
-- PART 3: Update RLS Policies for Admin Access
-- ============================================

-- Admin can view all user profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
CREATE POLICY "Admins can view all profiles" ON user_profiles
  FOR SELECT USING (
    auth.uid() = id OR
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

-- Admin can update any user profile
DROP POLICY IF EXISTS "Admins can update any profile" ON user_profiles;
CREATE POLICY "Admins can update any profile" ON user_profiles
  FOR UPDATE USING (
    auth.uid() = id OR
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

-- Admin can view all businesses
DROP POLICY IF EXISTS "Admins can view all businesses" ON businesses;
CREATE POLICY "Admins can view all businesses" ON businesses
  FOR SELECT USING (
    owner_user_id = auth.uid() OR
    owner_user_id IS NULL OR
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

-- Admin can update any business
DROP POLICY IF EXISTS "Admins can update any business" ON businesses;
CREATE POLICY "Admins can update any business" ON businesses
  FOR UPDATE USING (
    owner_user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

-- Admin can view all bookings
DROP POLICY IF EXISTS "Admins can view all bookings" ON bookings;
CREATE POLICY "Admins can view all bookings" ON bookings
  FOR SELECT USING (
    customer_user_id = auth.uid() OR
    customer_user_id IS NULL OR
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND user_type = 'admin'
    ) OR
    EXISTS (
      SELECT 1 FROM businesses 
      WHERE id = bookings.business_id 
        AND owner_user_id = auth.uid()
    )
  );

-- ============================================
-- VERIFICATION QUERY (Optional - run to verify)
-- ============================================

-- Check if admin was set correctly
-- SELECT up.id, up.user_type, au.email
-- FROM user_profiles up
-- JOIN auth.users au ON up.id = au.id
-- WHERE au.email = 'chinnuk0521@gmail.com';

-- ============================================
-- NOTES
-- ============================================

-- 1. The admin user can now access all data through RLS policies
-- 2. Admin role is included in the user_type enum
-- 3. RLS policies allow admins to view/update all records
-- 4. You can add more admin-specific features in the application code

