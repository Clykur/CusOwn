-- Add admin analytics audit action types. Safe to run multiple times.
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

ALTER TABLE audit_logs
  ADD CONSTRAINT audit_logs_action_type_check
  CHECK (action_type IN (
    'business_created', 'business_updated', 'business_deleted', 'business_suspended',
    'user_created', 'user_updated', 'user_deleted',
    'booking_created', 'booking_updated', 'booking_confirmed', 'booking_rejected',
    'booking_cancelled', 'booking_rescheduled', 'booking_no_show',
    'notification_sent', 'data_corrected', 'system_config_changed',
    'slot_reserved', 'slot_released', 'slot_booked',
    'payment_created', 'payment_succeeded', 'payment_failed', 'payment_refunded',
    'admin_revenue_export', 'admin_health_score_view', 'admin_funnel_analytics_view'
  ));
