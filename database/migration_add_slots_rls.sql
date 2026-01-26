-- Migration: Add RLS Policies to Slots Table
-- CRITICAL SECURITY FIX: Slots table currently has no RLS policies

-- Enable RLS on slots table
ALTER TABLE slots ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Public can view available slots" ON slots;
DROP POLICY IF EXISTS "Owners can view slots for their businesses" ON slots;
DROP POLICY IF EXISTS "Owners can update slots for their businesses" ON slots;
DROP POLICY IF EXISTS "Admins can view all slots" ON slots;
DROP POLICY IF EXISTS "Admins can update all slots" ON slots;

-- Policy: Public can view available/reserved slots (for booking flow)
-- This allows customers to see slot availability without authentication
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

-- Policy: System can insert slots (via service role)
-- Note: This is handled by service role which bypasses RLS
-- Regular users cannot insert slots directly

-- Policy: System can delete slots (via service role)
-- Note: This is handled by service role which bypasses RLS
-- Regular users cannot delete slots directly

-- ============================================
-- NOTES
-- ============================================
-- 1. Public users can only view available/reserved slots
-- 2. Owners can view and update slots for their businesses
-- 3. Admins can view and update all slots
-- 4. Slot creation/deletion is handled server-side with service role
-- 5. This prevents unauthorized slot manipulation
