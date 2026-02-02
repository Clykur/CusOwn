-- Phase 2: Payment audit action types + entity type 'payment' in audit_logs; replay-safe unique on webhook_payload_hash.
-- Safe to run multiple times (idempotent).
-- Requires: audit_logs (action_type check, entity_type check), payments (webhook_payload_hash).

-- 1. Add payment action types to audit_logs
DO $$
DECLARE
  constraint_name_var TEXT;
BEGIN
  SELECT constraint_name INTO constraint_name_var
  FROM information_schema.table_constraints
  WHERE table_schema = 'public'
    AND table_name = 'audit_logs'
    AND constraint_type = 'CHECK'
    AND constraint_name LIKE '%action_type%'
  LIMIT 1;

  IF constraint_name_var IS NOT NULL THEN
    EXECUTE 'ALTER TABLE audit_logs DROP CONSTRAINT ' || quote_ident(constraint_name_var);
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_type_check;
END $$;

ALTER TABLE audit_logs
  ADD CONSTRAINT audit_logs_action_type_check
  CHECK (action_type IN (
    'business_created', 'business_updated', 'business_deleted', 'business_suspended',
    'user_created', 'user_updated', 'user_deleted',
    'booking_created', 'booking_updated', 'booking_confirmed', 'booking_rejected',
    'booking_cancelled', 'booking_rescheduled', 'booking_no_show',
    'slot_reserved', 'slot_released', 'slot_booked',
    'notification_sent', 'data_corrected', 'system_config_changed',
    'payment_created', 'payment_succeeded', 'payment_failed', 'payment_refunded'
  ));

-- 2. Add entity_type 'payment' to audit_logs
DO $$
DECLARE
  entity_constraint_name TEXT;
BEGIN
  SELECT constraint_name INTO entity_constraint_name
  FROM information_schema.table_constraints
  WHERE table_schema = 'public'
    AND table_name = 'audit_logs'
    AND constraint_type = 'CHECK'
    AND constraint_name LIKE '%entity_type%'
  LIMIT 1;

  IF entity_constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE audit_logs DROP CONSTRAINT ' || quote_ident(entity_constraint_name);
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_entity_type_check;
END $$;

ALTER TABLE audit_logs
  ADD CONSTRAINT audit_logs_entity_type_check
  CHECK (entity_type IN ('business', 'user', 'booking', 'system', 'slot', 'payment'));

-- 3. Replay-safe: at most one payment per webhook payload hash (prevents duplicate processing of same webhook)
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_webhook_payload_hash_unique
  ON payments (webhook_payload_hash)
  WHERE webhook_payload_hash IS NOT NULL;

COMMENT ON INDEX idx_payments_webhook_payload_hash_unique IS 'Phase 2: Replay-safe; one payment per webhook payload hash.';
