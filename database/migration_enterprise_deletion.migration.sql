-- Migration: Enterprise-grade user and business deletion
-- Soft delete (30-day retention), legal hold, immutable audit, financial anonymization,
-- idempotent purge, restore validation, role enforcement, monitoring.
-- Safe to run when migration_soft_delete.sql and audit_logs exist.

-- ============================================
-- PART 1: Legal hold support
-- ============================================

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS legal_hold BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS legal_hold BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN user_profiles.legal_hold IS 'When true, soft/hard delete is blocked except with admin override.';
COMMENT ON COLUMN businesses.legal_hold IS 'When true, soft/hard delete is blocked except with admin override.';

CREATE INDEX IF NOT EXISTS idx_user_profiles_legal_hold ON user_profiles(legal_hold) WHERE legal_hold = TRUE;
CREATE INDEX IF NOT EXISTS idx_businesses_legal_hold ON businesses(legal_hold) WHERE legal_hold = TRUE;

-- ============================================
-- PART 2: Deletion audit (insert-only helper)
-- audit_logs already exists; add action types and insert helper.
-- ============================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'audit_logs'
      AND constraint_name LIKE '%action_type%'
  ) THEN
    ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_type_check;
  END IF;
EXCEPTION WHEN OTHERS THEN
  ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_type_check;
END $$;

-- Rewrite any existing rows with action_type not in the new list so ADD CONSTRAINT succeeds
UPDATE audit_logs
SET action_type = 'system_config_changed'
WHERE action_type IS NULL
   OR action_type NOT IN (
    'booking_created', 'booking_confirmed', 'booking_rejected', 'booking_cancelled',
    'booking_rescheduled', 'booking_no_show', 'booking_updated', 'booking_undo_accept', 'booking_undo_reject',
    'business_created', 'business_updated', 'business_deleted', 'business_suspended',
    'user_created', 'user_updated', 'user_deleted', 'role_changed', 'admin_login', 'admin_access_denied',
    'login_success', 'login_failed', 'password_reset',
    'payment_created', 'payment_succeeded', 'payment_failed', 'payment_refunded',
    'slot_reserved', 'slot_released', 'slot_booked',
    'notification_sent', 'data_corrected', 'system_config_changed', 'admin_revenue_export',
    'config_updated', 'cron_failed', 'cron_recovered', 'data_correction',
    'soft_delete', 'restore', 'hard_delete'
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
    'config_updated', 'cron_failed', 'cron_recovered', 'data_correction',
    'soft_delete', 'restore', 'hard_delete'
  ));

-- Immutable audit: no UPDATE/DELETE on audit_logs (enforce via RLS and trigger)
CREATE OR REPLACE FUNCTION audit_logs_deny_update_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'audit_logs: updates not allowed';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'audit_logs: deletes not allowed';
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS audit_logs_immutable ON audit_logs;
CREATE TRIGGER audit_logs_immutable
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE PROCEDURE audit_logs_deny_update_delete();

-- Helper: insert deletion/restore/hard_delete audit row (actor_id, reason, old_snapshot, ip)
CREATE OR REPLACE FUNCTION insert_deletion_audit(
  p_actor_id UUID,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_action TEXT,
  p_reason TEXT,
  p_old_snapshot JSONB,
  p_ip_address TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_action NOT IN ('soft_delete', 'restore', 'hard_delete') THEN
    RAISE EXCEPTION 'invalid deletion audit action: %', p_action;
  END IF;
  INSERT INTO audit_logs (
    admin_user_id,
    action_type,
    entity_type,
    entity_id,
    old_data,
    description,
    ip_address,
    status,
    severity
  ) VALUES (
    p_actor_id,
    p_action,
    p_entity_type,
    p_entity_id,
    p_old_snapshot,
    p_reason,
    p_ip_address,
    'success',
    CASE WHEN p_action = 'hard_delete' THEN 'warning' ELSE 'info' END
  );
END;
$$;

-- ============================================
-- PART 3: Hardened soft_delete_user_account
-- Blocks: legal hold, last admin, outstanding financial liability.
-- Logs: actor_id, reason, IP, old snapshot.
-- ============================================

CREATE OR REPLACE FUNCTION soft_delete_user_account(
  p_user_id UUID,
  p_actor_id UUID,
  p_reason TEXT,
  p_ip_address TEXT DEFAULT NULL,
  p_override_legal_hold BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_at TIMESTAMP WITH TIME ZONE := NOW();
  v_permanent_deletion_at TIMESTAMP WITH TIME ZONE := NOW() + INTERVAL '30 days';
  v_business_count INTEGER;
  v_profile RECORD;
  v_admin_count BIGINT;
  v_outstanding BIGINT;
  v_old_snapshot JSONB;
BEGIN
  IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
    RAISE EXCEPTION 'Deletion reason is mandatory';
  END IF;

  SELECT id, legal_hold, user_type, full_name, deleted_at
  INTO v_profile
  FROM user_profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  IF v_profile.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'User account is already soft-deleted';
  END IF;

  IF v_profile.legal_hold = TRUE AND (p_override_legal_hold IS NOT TRUE) THEN
    RAISE EXCEPTION 'User is under legal hold; deletion blocked';
  END IF;

  -- Block deleting last admin
  IF v_profile.user_type = 'admin' THEN
    SELECT COUNT(*) INTO v_admin_count
    FROM user_profiles
    WHERE user_type = 'admin' AND deleted_at IS NULL;
    IF v_admin_count <= 1 THEN
      RAISE EXCEPTION 'Cannot delete the last admin';
    END IF;
  END IF;

  -- Block if outstanding financial liability (payments pending/processing for user's bookings)
  SELECT COUNT(*) INTO v_outstanding
  FROM bookings b
  JOIN payments p ON p.booking_id = b.id
  WHERE b.customer_user_id = p_user_id
    AND p.status IN ('pending', 'processing', 'initiated');
  IF v_outstanding > 0 THEN
    RAISE EXCEPTION 'User has outstanding payments; resolve before deletion';
  END IF;

  v_old_snapshot := to_jsonb(v_profile);

  UPDATE user_profiles
  SET
    deleted_at = v_deleted_at,
    permanent_deletion_at = v_permanent_deletion_at,
    deletion_reason = p_reason,
    updated_at = v_deleted_at
  WHERE id = p_user_id AND deleted_at IS NULL;

  UPDATE businesses
  SET
    deleted_at = v_deleted_at,
    permanent_deletion_at = v_permanent_deletion_at,
    deletion_reason = 'Owner account deleted: ' || p_reason,
    updated_at = v_deleted_at
  WHERE owner_user_id = p_user_id AND deleted_at IS NULL;

  GET DIAGNOSTICS v_business_count = ROW_COUNT;

  PERFORM insert_deletion_audit(
    p_actor_id, 'user', p_user_id, 'soft_delete', p_reason, v_old_snapshot, p_ip_address
  );

  RETURN jsonb_build_object(
    'user_id', p_user_id,
    'deleted_at', v_deleted_at,
    'permanent_deletion_at', v_permanent_deletion_at,
    'businesses_deleted', v_business_count
  );
END;
$$;

COMMENT ON FUNCTION soft_delete_user_account(UUID, UUID, TEXT, TEXT, BOOLEAN) IS 'Soft delete user and owned businesses. 30-day retention. Blocks: legal hold, last admin, outstanding payments.';

-- Backward-compatible 2-arg overload (actor = user, no IP, no override)
CREATE OR REPLACE FUNCTION soft_delete_user_account(p_user_id UUID, p_reason TEXT)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT soft_delete_user_account(p_user_id, p_user_id, p_reason, NULL::TEXT, FALSE);
$$;

-- ============================================
-- PART 4: soft_delete_business
-- ============================================

CREATE OR REPLACE FUNCTION soft_delete_business(
  p_business_id UUID,
  p_actor_id UUID,
  p_reason TEXT,
  p_ip_address TEXT DEFAULT NULL,
  p_override_legal_hold BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_at TIMESTAMP WITH TIME ZONE := NOW();
  v_permanent_deletion_at TIMESTAMP WITH TIME ZONE := NOW() + INTERVAL '30 days';
  v_biz RECORD;
  v_old_snapshot JSONB;
BEGIN
  IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
    RAISE EXCEPTION 'Deletion reason is mandatory';
  END IF;

  SELECT id, owner_user_id, salon_name, legal_hold, deleted_at
  INTO v_biz
  FROM businesses
  WHERE id = p_business_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Business not found';
  END IF;

  IF v_biz.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Business is already soft-deleted';
  END IF;

  IF v_biz.legal_hold = TRUE AND (p_override_legal_hold IS NOT TRUE) THEN
    RAISE EXCEPTION 'Business is under legal hold; deletion blocked';
  END IF;

  v_old_snapshot := to_jsonb(v_biz);

  UPDATE businesses
  SET
    deleted_at = v_deleted_at,
    permanent_deletion_at = v_permanent_deletion_at,
    deletion_reason = p_reason,
    updated_at = v_deleted_at
  WHERE id = p_business_id AND deleted_at IS NULL;

  PERFORM insert_deletion_audit(
    p_actor_id, 'business', p_business_id, 'soft_delete', p_reason, v_old_snapshot, p_ip_address
  );

  RETURN jsonb_build_object(
    'business_id', p_business_id,
    'deleted_at', v_deleted_at,
    'permanent_deletion_at', v_permanent_deletion_at
  );
END;
$$;

COMMENT ON FUNCTION soft_delete_business IS 'Soft delete a business. 30-day retention. Blocks when legal_hold.';

-- ============================================
-- PART 5: Financial anonymization (before hard delete)
-- Preserve transaction history; null user refs and anonymize PII.
-- ============================================

CREATE OR REPLACE FUNCTION anonymize_user_financial_data(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Bookings: anonymize customer PII; keep booking_id for payment history
  UPDATE bookings
  SET
    customer_user_id = NULL,
    customer_name = '[anonymized]',
    customer_email = NULL,
    customer_phone = NULL
  WHERE customer_user_id = p_user_id;

  -- Payments: null user references (refunded_by, verified_by)
  UPDATE payments SET refunded_by = NULL WHERE refunded_by = p_user_id;
  UPDATE payments SET verified_by = NULL WHERE verified_by = p_user_id;

  -- payment_audit_logs: null actor for deleted user
  UPDATE payment_audit_logs SET actor_id = NULL WHERE actor_id = p_user_id;
END;
$$;

COMMENT ON FUNCTION anonymize_user_financial_data IS 'Anonymize PII and null user refs for compliance; preserve transaction history.';

-- ============================================
-- PART 6: Idempotent cleanup_expired_soft_deletes
-- Select where permanent_deletion_at < now(); anonymize; hard delete; log.
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_expired_soft_deleted_records()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_users_deleted INTEGER := 0;
  v_businesses_deleted INTEGER := 0;
  v_user_id UUID;
  v_biz_id UUID;
  v_old JSONB;
  v_actor_system CONSTANT UUID := NULL;
BEGIN
  -- Process businesses first (children before parent user where applicable)
  FOR v_biz_id IN
    SELECT id FROM businesses
    WHERE permanent_deletion_at IS NOT NULL AND permanent_deletion_at <= NOW()
  LOOP
    SELECT to_jsonb(b) INTO v_old FROM businesses b WHERE b.id = v_biz_id;
    PERFORM insert_deletion_audit(v_actor_system, 'business', v_biz_id, 'hard_delete',
      'Purge job: retention period expired', v_old, NULL);
    DELETE FROM businesses WHERE id = v_biz_id;
    v_businesses_deleted := v_businesses_deleted + 1;
  END LOOP;

  -- Then users: anonymize then hard delete
  FOR v_user_id IN
    SELECT id FROM user_profiles
    WHERE permanent_deletion_at IS NOT NULL AND permanent_deletion_at <= NOW()
  LOOP
    PERFORM anonymize_user_financial_data(v_user_id);
    SELECT to_jsonb(row_to_json(up)) INTO v_old FROM user_profiles up WHERE up.id = v_user_id;
    PERFORM insert_deletion_audit(v_actor_system, 'user', v_user_id, 'hard_delete',
      'Purge job: retention period expired', v_old, NULL);
    DELETE FROM user_profiles WHERE id = v_user_id;
    v_users_deleted := v_users_deleted + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'cleanup_time', NOW(),
    'users_deleted', v_users_deleted,
    'businesses_deleted', v_businesses_deleted
  );
END;
$$;

COMMENT ON FUNCTION cleanup_expired_soft_deleted_records IS 'Idempotent purge: hard-delete entities past retention; anonymize user financial data first.';

-- ============================================
-- PART 7: Restore with safety (email not reused handled in app if needed)
-- ============================================

CREATE OR REPLACE FUNCTION restore_deleted_user_account(
  p_user_id UUID,
  p_actor_id UUID DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_restored_at TIMESTAMP WITH TIME ZONE := NOW();
  v_business_count INTEGER;
  v_profile RECORD;
  v_old_snapshot JSONB;
BEGIN
  SELECT * INTO v_profile
  FROM user_profiles
  WHERE id = p_user_id AND deleted_at IS NOT NULL AND (permanent_deletion_at IS NULL OR permanent_deletion_at > NOW());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found, not deleted, or past recovery period';
  END IF;

  v_old_snapshot := to_jsonb(v_profile);

  UPDATE user_profiles
  SET deleted_at = NULL, permanent_deletion_at = NULL, deletion_reason = NULL, updated_at = v_restored_at
  WHERE id = p_user_id;

  UPDATE businesses
  SET deleted_at = NULL, permanent_deletion_at = NULL, deletion_reason = NULL, updated_at = v_restored_at
  WHERE owner_user_id = p_user_id AND deleted_at IS NOT NULL;

  GET DIAGNOSTICS v_business_count = ROW_COUNT;

  PERFORM insert_deletion_audit(p_actor_id, 'user', p_user_id, 'restore',
    'Account restored within retention period', v_old_snapshot, p_ip_address);

  RETURN jsonb_build_object(
    'user_id', p_user_id,
    'restored_at', v_restored_at,
    'businesses_restored', v_business_count
  );
END;
$$;

COMMENT ON FUNCTION restore_deleted_user_account IS 'Restore soft-deleted user and owned businesses. Safe to run within 30-day window.';

-- ============================================
-- PART 8: deletion_events for monitoring
-- ============================================

CREATE TABLE IF NOT EXISTS deletion_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('user', 'business')),
  entity_id UUID,
  action TEXT NOT NULL CHECK (action IN ('soft_delete', 'restore', 'hard_delete', 'purge_failed')),
  success BOOLEAN NOT NULL DEFAULT TRUE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
COMMENT ON COLUMN deletion_events.entity_id IS 'NULL for purge_failed when the whole job fails.';

CREATE INDEX IF NOT EXISTS idx_deletion_events_entity ON deletion_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_deletion_events_created ON deletion_events(created_at DESC);

ALTER TABLE deletion_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only for deletion_events"
  ON deletion_events FOR ALL
  USING (auth.role() = 'service_role');

COMMENT ON TABLE deletion_events IS 'Monitoring: deletion/restore events and purge failures.';

-- ============================================
-- PART 9: Grants and backward compatibility
-- ============================================

REVOKE ALL ON FUNCTION soft_delete_user_account(UUID, UUID, TEXT, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION soft_delete_user_account(UUID, UUID, TEXT, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION soft_delete_user_account(UUID, UUID, TEXT, TEXT, BOOLEAN) TO service_role;
REVOKE ALL ON FUNCTION soft_delete_user_account(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION soft_delete_user_account(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION soft_delete_user_account(UUID, TEXT) TO service_role;

REVOKE ALL ON FUNCTION soft_delete_business(UUID, UUID, TEXT, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION soft_delete_business(UUID, UUID, TEXT, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION soft_delete_business(UUID, UUID, TEXT, TEXT, BOOLEAN) TO service_role;

REVOKE ALL ON FUNCTION cleanup_expired_soft_deleted_records() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cleanup_expired_soft_deleted_records() TO service_role;

REVOKE ALL ON FUNCTION restore_deleted_user_account(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION restore_deleted_user_account(UUID, UUID, TEXT) TO service_role;

REVOKE ALL ON FUNCTION insert_deletion_audit(UUID, TEXT, UUID, TEXT, TEXT, JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION insert_deletion_audit(UUID, TEXT, UUID, TEXT, TEXT, JSONB, TEXT) TO service_role;

REVOKE ALL ON FUNCTION anonymize_user_financial_data(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION anonymize_user_financial_data(UUID) TO service_role;
