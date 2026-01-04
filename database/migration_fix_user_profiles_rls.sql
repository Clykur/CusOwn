-- Migration: Fix Infinite Recursion in user_profiles RLS Policies
-- This fixes the "infinite recursion detected in policy" error
-- SAFE to run - won't break existing data

-- ============================================
-- PART 1: Drop existing problematic policies
-- ============================================

-- Drop all existing policies on user_profiles
DROP POLICY IF EXISTS "Users can view their own profile." ON user_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile." ON user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON user_profiles;

-- ============================================
-- PART 2: Create fixed policies without recursion
-- ============================================

-- Simple policy: Users can view their own profile
CREATE POLICY "Users can view their own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

-- Users can insert their own profile
CREATE POLICY "Users can insert their own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update their own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- ============================================
-- PART 3: Create SECURITY DEFINER function for admin checks
-- ============================================

-- Function to check if current user is admin (without recursion)
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if current user's profile has admin type
  -- Using SECURITY DEFINER to bypass RLS for this check
  RETURN EXISTS (
    SELECT 1 
    FROM public.user_profiles 
    WHERE id = auth.uid() 
      AND user_type = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- PART 4: Create admin policies using the function
-- ============================================

-- Admin can view all profiles (using function to avoid recursion)
CREATE POLICY "Admins can view all profiles" ON user_profiles
  FOR SELECT USING (
    auth.uid() = id OR
    public.is_admin_user()
  );

-- Admin can update any profile (using function to avoid recursion)
CREATE POLICY "Admins can update any profile" ON user_profiles
  FOR UPDATE USING (
    auth.uid() = id OR
    public.is_admin_user()
  );

-- ============================================
-- NOTES
-- ============================================

-- The is_admin_user() function uses SECURITY DEFINER to bypass RLS
-- when checking admin status, preventing infinite recursion.
-- This allows admins to view/update all profiles without circular policy checks.

