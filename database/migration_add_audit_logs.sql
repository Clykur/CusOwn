-- Migration: Add Audit Logs Table
-- This migration creates an audit log table to track admin actions
-- SAFE to run - won't break existing data

-- ============================================
-- PART 1: Create Audit Logs Table
-- ============================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL CHECK (action_type IN (
    'business_created',
    'business_updated',
    'business_deleted',
    'business_suspended',
    'user_created',
    'user_updated',
    'user_deleted',
    'booking_updated',
    'booking_cancelled',
    'notification_sent',
    'data_corrected',
    'system_config_changed'
  )),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('business', 'user', 'booking', 'system')),
  entity_id UUID,
  old_data JSONB,
  new_data JSONB,
  description TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_user_id ON audit_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id ON audit_logs(entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- RLS Policies for Audit Logs (only admins can view)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all audit logs" ON audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

CREATE POLICY "System can insert audit logs" ON audit_logs
  FOR INSERT WITH CHECK (true);

-- ============================================
-- PART 2: Add Suspended Status to Businesses
-- ============================================

-- Add suspended column to businesses
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS suspended BOOLEAN DEFAULT FALSE;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS suspended_reason TEXT;

-- Index for suspended businesses
CREATE INDEX IF NOT EXISTS idx_businesses_suspended ON businesses(suspended) WHERE suspended = true;

-- ============================================
-- NOTES
-- ============================================

-- 1. Audit logs track all admin actions for accountability
-- 2. Suspended businesses are hidden from public but visible to admins
-- 3. All admin actions should create audit log entries

