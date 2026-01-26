-- Migration: Add Default DENY RLS Policies
-- CRITICAL SECURITY: Explicitly deny all access by default, then allow specific cases
-- SAFE to run - won't break existing data

-- ============================================
-- SLOTS TABLE - Default DENY
-- ============================================

-- Enable RLS (idempotent - safe to run multiple times)
ALTER TABLE slots ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (from previous migration)
DROP POLICY IF EXISTS "Public can view available slots" ON slots;
DROP POLICY IF EXISTS "Owners can view slots for their businesses" ON slots;
DROP POLICY IF EXISTS "Owners can update slots for their businesses" ON slots;
DROP POLICY IF EXISTS "Admins can view all slots" ON slots;
DROP POLICY IF EXISTS "Admins can update all slots" ON slots;

-- Policy: Public can view available/reserved slots (for booking flow)
CREATE POLICY "Public can view available slots" ON slots
  FOR SELECT USING (
    status IN ('available', 'reserved')
  );

-- Policy: Owners can view all slots for their businesses
CREATE POLICY "Owners can view slots for their businesses" ON slots
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM businesses 
      WHERE id = slots.business_id 
        AND owner_user_id = auth.uid()
    )
  );

-- Policy: Owners can update slots for their businesses
CREATE POLICY "Owners can update slots for their businesses" ON slots
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM businesses 
      WHERE id = slots.business_id 
        AND owner_user_id = auth.uid()
    )
  );

-- Policy: Admins can view all slots
CREATE POLICY "Admins can view all slots" ON slots
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

-- Policy: Admins can update all slots
CREATE POLICY "Admins can update all slots" ON slots
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

-- Note: INSERT and DELETE are handled by service role (bypasses RLS)
-- Regular users cannot insert/delete slots directly

-- ============================================
-- BUSINESSES TABLE - Ensure RLS Enabled
-- ============================================

-- Ensure RLS is enabled (idempotent)
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

-- Note: Existing policies already enforce ownership
-- Default is DENY (no access unless policy allows)

-- ============================================
-- BOOKINGS TABLE - Ensure RLS Enabled
-- ============================================

-- Ensure RLS is enabled (idempotent)
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Note: Existing policies already enforce customer/owner/admin access
-- Default is DENY (no access unless policy allows)

-- ============================================
-- USER_PROFILES TABLE - Ensure RLS Enabled
-- ============================================

-- Ensure RLS is enabled (idempotent)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Note: Existing policies already enforce self-access and admin access
-- Default is DENY (no access unless policy allows)

-- ============================================
-- AUDIT_LOGS TABLE - Ensure RLS Enabled
-- ============================================

-- Ensure RLS is enabled (idempotent)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Note: Existing policies already enforce admin-only access
-- Default is DENY (no access unless policy allows)

-- ============================================
-- VERIFICATION (Optional - run to check RLS status)
-- ============================================
-- SELECT tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE schemaname = 'public' 
--   AND tablename IN ('slots', 'businesses', 'bookings', 'user_profiles', 'audit_logs');

-- ============================================
-- NOTES
-- ============================================
-- 1. Supabase RLS defaults to DENY (no access unless policy allows)
-- 2. All tables now have explicit policies
-- 3. Service role (supabaseAdmin) bypasses RLS for system operations
-- 4. Public access is intentionally minimal (available slots only)
-- 5. All mutations require explicit authorization
-- 6. This migration is idempotent - safe to run multiple times
