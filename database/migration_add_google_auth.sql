-- Migration: Add Google Authentication Support
-- This migration is SAFE to run - it won't break existing data
-- All new columns are nullable, so existing records will work fine

-- ============================================
-- PART 1: Create User Profiles Table
-- ============================================

-- Create user_profiles table to store additional user information
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_type TEXT NOT NULL DEFAULT 'customer' CHECK (user_type IN ('owner', 'customer', 'both')),
  full_name TEXT,
  phone_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for user_type lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_type ON user_profiles(user_type);

-- Enable RLS on user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can read their own profile
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

-- RLS Policy: Users can update their own profile
CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- RLS Policy: Users can insert their own profile
CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ============================================
-- PART 2: Add Owner User ID to Businesses
-- ============================================

-- Add owner_user_id column (nullable for backward compatibility)
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create index for owner lookups
CREATE INDEX IF NOT EXISTS idx_businesses_owner_user_id ON businesses(owner_user_id) WHERE owner_user_id IS NOT NULL;

-- RLS Policy: Owners can view their own businesses
CREATE POLICY "Owners can view own businesses" ON businesses
  FOR SELECT USING (owner_user_id = auth.uid() OR owner_user_id IS NULL);

-- RLS Policy: Owners can update their own businesses
CREATE POLICY "Owners can update own businesses" ON businesses
  FOR UPDATE USING (owner_user_id = auth.uid());

-- RLS Policy: Owners can insert businesses (with their user_id)
CREATE POLICY "Owners can insert own businesses" ON businesses
  FOR INSERT WITH CHECK (owner_user_id = auth.uid());

-- ============================================
-- PART 3: Add Customer User ID to Bookings
-- ============================================

-- Add customer_user_id column (nullable for backward compatibility)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create index for customer lookups
CREATE INDEX IF NOT EXISTS idx_bookings_customer_user_id ON bookings(customer_user_id) WHERE customer_user_id IS NOT NULL;

-- RLS Policy: Customers can view their own bookings
CREATE POLICY "Customers can view own bookings" ON bookings
  FOR SELECT USING (customer_user_id = auth.uid() OR customer_user_id IS NULL);

-- RLS Policy: Customers can update their own bookings (for cancellation, etc.)
CREATE POLICY "Customers can update own bookings" ON bookings
  FOR UPDATE USING (customer_user_id = auth.uid());

-- ============================================
-- PART 4: Create Function to Auto-Create Profile
-- ============================================

-- Function to automatically create user profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, user_type, full_name)
  VALUES (
    NEW.id,
    'customer', -- Default to customer, can be updated later
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- PART 5: Create Function to Update Updated At
-- ============================================

-- Trigger for user_profiles updated_at
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VERIFICATION QUERIES (Optional - run to verify)
-- ============================================

-- Check if columns were added
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'businesses' AND column_name = 'owner_user_id';

-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'bookings' AND column_name = 'customer_user_id';

-- Check if user_profiles table exists
-- SELECT * FROM information_schema.tables WHERE table_name = 'user_profiles';

-- ============================================
-- NOTES
-- ============================================

-- 1. All new columns are nullable, so existing data continues to work
-- 2. RLS policies allow public access where user_id is NULL (backward compatibility)
-- 3. Users can gradually link their accounts to existing businesses/bookings
-- 4. The trigger automatically creates a profile when a user signs up
-- 5. Default user_type is 'customer', can be upgraded to 'owner' or 'both'

