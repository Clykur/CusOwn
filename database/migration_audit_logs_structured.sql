-- Migration: Structured audit logs — add actor_role, status, metadata, severity; indexes.
-- Keeps audit_logs table and admin_user_id. Safe to run when table exists.

-- Add new columns (ignore if already exist)
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_role TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'success' NOT NULL;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'info' NOT NULL;

-- Constrain status and severity
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_status_check;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_status_check
  CHECK (status IN ('success', 'failed'));

ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_severity_check;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_severity_check
  CHECK (severity IN ('info', 'warning', 'critical'));

-- Backfill existing rows
UPDATE audit_logs SET status = 'success' WHERE status IS NULL;
UPDATE audit_logs SET severity = 'info' WHERE severity IS NULL;

-- Drop existing action_type check and add structured list (no view events)
DO $$
DECLARE
  cname TEXT;
BEGIN
  SELECT tc.constraint_name INTO cname
  FROM information_schema.table_constraints tc
  WHERE tc.table_schema = 'public' AND tc.table_name = 'audit_logs'
    AND tc.constraint_type = 'CHECK'
    AND tc.constraint_name LIKE '%action_type%'
  LIMIT 1;
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE audit_logs DROP CONSTRAINT %I', cname);
  END IF;
EXCEPTION WHEN OTHERS THEN
  ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_type_check;
END $$;

-- Rewrite rows that use removed or legacy action types so the new CHECK can be applied
UPDATE audit_logs
SET action_type = 'system_config_changed'
WHERE action_type IN ('admin_health_score_view', 'admin_funnel_analytics_view')
   OR action_type NOT IN (
    'booking_created', 'booking_confirmed', 'booking_rejected', 'booking_cancelled',
    'booking_rescheduled', 'booking_no_show', 'booking_updated', 'booking_undo_accept', 'booking_undo_reject',
    'business_created', 'business_updated', 'business_deleted', 'business_suspended',
    'user_created', 'user_updated', 'user_deleted', 'role_changed', 'admin_login', 'admin_access_denied',
    'login_success', 'login_failed', 'password_reset',
    'payment_created', 'payment_succeeded', 'payment_failed', 'payment_refunded',
    'slot_reserved', 'slot_released', 'slot_booked',
    'notification_sent', 'data_corrected', 'system_config_changed', 'admin_revenue_export',
    'config_updated', 'cron_failed', 'cron_recovered', 'data_correction'
  );

ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_action_type_check
  CHECK (action_type IN (
    'booking_created', 'booking_confirmed', 'booking_rejected', 'booking_cancelled',
    'booking_rescheduled', 'booking_no_show', 'booking_updated', 'booking_undo_accept', 'booking_undo_reject',
    'business_created', 'business_updated', 'business_deleted', 'business_suspended',
    'user_created', 'user_updated', 'user_deleted', 'role_changed', 'admin_login', 'admin_access_denied',
    'login_success', 'login_failed', 'password_reset',
    'payment_created', 'payment_succeeded', 'payment_failed', 'payment_refunded',
    'slot_reserved', 'slot_released', 'slot_booked',
    'notification_sent', 'data_corrected', 'system_config_changed', 'admin_revenue_export',
    'config_updated', 'cron_failed', 'cron_recovered', 'data_correction'
  ));

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON audit_logs(severity);
CREATE INDEX IF NOT EXISTS idx_audit_logs_status ON audit_logs(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at_desc ON audit_logs(created_at DESC);
