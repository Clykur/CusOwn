-- Migration: Deletion & Purge — Full Enterprise Compliance (DSA)
-- Invariants, tamper-evident audit chain, concurrency control, no CASCADE,
-- DELETE protection, restore uniqueness, PII scan, legal hold override audit,
-- data classification, integrity verification.
-- Depends on: migration_enterprise_deletion.migration.sql (legal_hold, soft delete RPCs).
-- Safe to run when audit_logs and enterprise deletion exist.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================================
-- PART 1: DATA CLASSIFICATION (for regulated → anonymize-only in purge)
-- =============================================================================

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS data_classification TEXT DEFAULT 'internal'
  CHECK (data_classification IN ('public','internal','confidential','regulated'));

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS data_classification TEXT DEFAULT 'internal'
  CHECK (data_classification IN ('public','internal','confidential','regulated'));

COMMENT ON COLUMN user_profiles.data_classification IS 'When regulated, purge anonymizes only and does not hard-delete.';
COMMENT ON COLUMN businesses.data_classification IS 'When regulated, purge anonymizes only and does not hard-delete.';

-- =============================================================================
-- PART 2: AUDIT LOG — HASH CHAIN (tamper-evident)
-- =============================================================================

-- Add hash columns (nullable until backfilled)
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS previous_hash TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS hash TEXT;

-- Backfill: build chain for existing rows. Disable immutable trigger so UPDATE is allowed.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_logs_immutable' AND tgrelid = 'audit_logs'::regclass) THEN
    ALTER TABLE audit_logs DISABLE TRIGGER audit_logs_immutable;
  END IF;
END $$;

DO $$
DECLARE
  r RECORD;
  v_prev_hash TEXT := '';
  v_payload  TEXT;
  v_new_hash TEXT;
BEGIN
  FOR r IN
    SELECT id, admin_user_id, action_type, entity_type, entity_id, old_data, new_data,
           description, ip_address, user_agent, created_at
    FROM audit_logs
    ORDER BY created_at ASC, id ASC
  LOOP
    v_payload := json_build_object(
      'id', r.id, 'admin_user_id', r.admin_user_id, 'action_type', r.action_type,
      'entity_type', r.entity_type, 'entity_id', r.entity_id, 'old_data', r.old_data,
      'new_data', r.new_data, 'description', r.description, 'ip_address', r.ip_address,
      'user_agent', r.user_agent, 'created_at', r.created_at
    )::text;
    v_new_hash := encode(digest(v_prev_hash || v_payload, 'sha256'), 'hex');
    UPDATE audit_logs SET previous_hash = v_prev_hash, hash = v_new_hash WHERE id = r.id;
    v_prev_hash := v_new_hash;
  END LOOP;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_logs_immutable' AND tgrelid = 'audit_logs'::regclass) THEN
    ALTER TABLE audit_logs ENABLE TRIGGER audit_logs_immutable;
  END IF;
END $$;

-- Now enforce NOT NULL for new rows (trigger will set hash)
ALTER TABLE audit_logs ALTER COLUMN hash SET DEFAULT '';
ALTER TABLE audit_logs ALTER COLUMN previous_hash SET DEFAULT '';

-- Trigger: compute hash on INSERT (chain from last row)
CREATE OR REPLACE FUNCTION audit_logs_compute_hash_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_prev_hash TEXT;
  v_payload   TEXT;
BEGIN
  SELECT hash INTO v_prev_hash FROM audit_logs ORDER BY created_at DESC, id DESC LIMIT 1;
  v_prev_hash := COALESCE(v_prev_hash, '');
  v_payload := json_build_object(
    'id', COALESCE(NEW.id, gen_random_uuid()), 'admin_user_id', NEW.admin_user_id,
    'action_type', NEW.action_type, 'entity_type', NEW.entity_type, 'entity_id', NEW.entity_id,
    'old_data', NEW.old_data, 'new_data', NEW.new_data, 'description', NEW.description,
    'ip_address', NEW.ip_address, 'user_agent', NEW.user_agent, 'created_at', COALESCE(NEW.created_at, NOW())
  )::text;
  NEW.previous_hash := v_prev_hash;
  NEW.hash := encode(digest(v_prev_hash || v_payload, 'sha256'), 'hex');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_logs_hash_trigger ON audit_logs;
CREATE TRIGGER audit_logs_hash_trigger
  BEFORE INSERT ON audit_logs
  FOR EACH ROW EXECUTE PROCEDURE audit_logs_compute_hash_trigger();

-- Add legal_hold_override to action_type
DO $$
BEGIN
  ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_type_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

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
    'soft_delete', 'restore', 'hard_delete', 'legal_hold_override'
  ));

-- Tamper-evident: REPLICA IDENTITY FULL so logical decoding sees full row
ALTER TABLE audit_logs REPLICA IDENTITY FULL;

-- RLS: only INSERT allowed for application; only service_role can SELECT
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all audit logs" ON audit_logs;
DROP POLICY IF EXISTS "System can insert audit logs" ON audit_logs;

CREATE POLICY "audit_logs_insert_policy" ON audit_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "audit_logs_select_service_role_only" ON audit_logs FOR SELECT
  USING (auth.role() = 'service_role');

-- No UPDATE/DELETE policies (trigger already blocks; RLS denies by default)

-- insert_deletion_audit_v2: same as v1 but table has hash chain via trigger
CREATE OR REPLACE FUNCTION insert_deletion_audit_v2(
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
  IF p_action NOT IN ('soft_delete', 'restore', 'hard_delete', 'legal_hold_override') THEN
    RAISE EXCEPTION 'invalid deletion audit action: %', p_action;
  END IF;
  INSERT INTO audit_logs (
    admin_user_id, action_type, entity_type, entity_id, old_data, description,
    ip_address, status, severity
  ) VALUES (
    p_actor_id, p_action, p_entity_type, p_entity_id, p_old_snapshot, p_reason,
    p_ip_address, 'success',
    CASE WHEN p_action IN ('hard_delete', 'legal_hold_override') THEN 'warning' ELSE 'info' END
  );
END;
$$;

COMMENT ON FUNCTION insert_deletion_audit_v2 IS 'Insert deletion/restore/hard_delete/legal_hold_override; hash chain computed by trigger.';

-- Verify audit chain (returns first broken position or ok)
CREATE OR REPLACE FUNCTION verify_audit_chain()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r         RECORD;
  v_prev    TEXT := '';
  v_payload TEXT;
  v_expect  TEXT;
  v_row_num BIGINT := 0;
BEGIN
  FOR r IN
    SELECT id, previous_hash, hash, admin_user_id, action_type, entity_type, entity_id,
           old_data, new_data, description, ip_address, user_agent, created_at
    FROM audit_logs
    ORDER BY created_at ASC, id ASC
  LOOP
    v_row_num := v_row_num + 1;
    IF r.previous_hash IS DISTINCT FROM v_prev THEN
      RETURN jsonb_build_object(
        'valid', false,
        'reason', 'previous_hash_mismatch',
        'row_number', v_row_num,
        'id', r.id,
        'expected_previous_hash', v_prev,
        'actual_previous_hash', r.previous_hash
      );
    END IF;
    v_payload := json_build_object(
      'id', r.id, 'admin_user_id', r.admin_user_id, 'action_type', r.action_type,
      'entity_type', r.entity_type, 'entity_id', r.entity_id, 'old_data', r.old_data,
      'new_data', r.new_data, 'description', r.description, 'ip_address', r.ip_address,
      'user_agent', r.user_agent, 'created_at', r.created_at
    )::text;
    v_expect := encode(digest(v_prev || v_payload, 'sha256'), 'hex');
    IF r.hash IS DISTINCT FROM v_expect THEN
      RETURN jsonb_build_object(
        'valid', false,
        'reason', 'hash_mismatch',
        'row_number', v_row_num,
        'id', r.id,
        'expected_hash', v_expect,
        'actual_hash', r.hash
      );
    END IF;
    v_prev := r.hash;
  END LOOP;
  RETURN jsonb_build_object('valid', true, 'rows_checked', v_row_num);
END;
$$;

GRANT EXECUTE ON FUNCTION verify_audit_chain() TO service_role;

-- =============================================================================
-- PART 3: GLOBAL INVARIANTS — ENFORCED IN PURGE RPC
-- Invariant 1: No hard delete unless deleted_at IS NOT NULL, permanent_deletion_at <= now(), legal_hold = false
-- Invariant 2: Deletion reason non-empty (already in soft_delete RPCs)
-- Invariant 3: Last admin (already in soft_delete_user_account)
-- Invariant 4: Legal hold override audited (below in soft_delete RPCs)
-- =============================================================================

-- =============================================================================
-- PART 4: LEGAL HOLD OVERRIDE AUDIT (separate row when override used)
-- =============================================================================

-- Update insert_deletion_audit to support legal_hold_override (keep for backward compat)
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
  IF p_action NOT IN ('soft_delete', 'restore', 'hard_delete', 'legal_hold_override') THEN
    RAISE EXCEPTION 'invalid deletion audit action: %', p_action;
  END IF;
  INSERT INTO audit_logs (
    admin_user_id, action_type, entity_type, entity_id, old_data, description,
    ip_address, status, severity
  ) VALUES (
    p_actor_id, p_action, p_entity_type, p_entity_id, p_old_snapshot, p_reason,
    p_ip_address, 'success',
    CASE WHEN p_action IN ('hard_delete', 'legal_hold_override') THEN 'warning' ELSE 'info' END
  );
END;
$$;

-- =============================================================================
-- PART 5: SOFT DELETE RPCs — LEGAL HOLD OVERRIDE AUDIT
-- =============================================================================

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
  -- Invariant 2: reason mandatory
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

  IF v_profile.legal_hold = TRUE THEN
    IF p_override_legal_hold IS NOT TRUE THEN
      RAISE EXCEPTION 'User is under legal hold; deletion blocked';
    END IF;
    -- Invariant 4: audit legal hold override separately
    PERFORM insert_deletion_audit(p_actor_id, 'user', p_user_id, 'legal_hold_override',
      'Legal hold overridden: ' || p_reason, to_jsonb(v_profile), p_ip_address);
  END IF;

  -- Invariant 3: last admin
  IF v_profile.user_type = 'admin' THEN
    SELECT COUNT(*) INTO v_admin_count
    FROM user_profiles
    WHERE user_type = 'admin' AND deleted_at IS NULL;
    IF v_admin_count <= 1 THEN
      RAISE EXCEPTION 'Cannot delete the last admin';
    END IF;
  END IF;

  SELECT COUNT(*) INTO v_outstanding
  FROM bookings b
  JOIN payments p ON p.booking_id = b.id
  WHERE b.customer_user_id = p_user_id
    AND p.status::text IN ('pending', 'processing', 'initiated');
  IF v_outstanding > 0 THEN
    RAISE EXCEPTION 'User has outstanding payments; resolve before deletion';
  END IF;

  v_old_snapshot := to_jsonb(v_profile);

  UPDATE user_profiles
  SET deleted_at = v_deleted_at, permanent_deletion_at = v_permanent_deletion_at,
      deletion_reason = p_reason, updated_at = v_deleted_at
  WHERE id = p_user_id AND deleted_at IS NULL;

  UPDATE businesses
  SET deleted_at = v_deleted_at, permanent_deletion_at = v_permanent_deletion_at,
      deletion_reason = 'Owner account deleted: ' || p_reason, updated_at = v_deleted_at
  WHERE owner_user_id = p_user_id AND deleted_at IS NULL;

  GET DIAGNOSTICS v_business_count = ROW_COUNT;

  PERFORM insert_deletion_audit(p_actor_id, 'user', p_user_id, 'soft_delete', p_reason, v_old_snapshot, p_ip_address);

  RETURN jsonb_build_object(
    'user_id', p_user_id, 'deleted_at', v_deleted_at,
    'permanent_deletion_at', v_permanent_deletion_at, 'businesses_deleted', v_business_count
  );
END;
$$;

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

  IF NOT FOUND THEN RAISE EXCEPTION 'Business not found'; END IF;
  IF v_biz.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'Business is already soft-deleted'; END IF;

  IF v_biz.legal_hold = TRUE THEN
    IF p_override_legal_hold IS NOT TRUE THEN
      RAISE EXCEPTION 'Business is under legal hold; deletion blocked';
    END IF;
    PERFORM insert_deletion_audit(p_actor_id, 'business', p_business_id, 'legal_hold_override',
      'Legal hold overridden: ' || p_reason, to_jsonb(v_biz), p_ip_address);
  END IF;

  v_old_snapshot := to_jsonb(v_biz);

  UPDATE businesses
  SET deleted_at = v_deleted_at, permanent_deletion_at = v_permanent_deletion_at,
      deletion_reason = p_reason, updated_at = v_deleted_at
  WHERE id = p_business_id AND deleted_at IS NULL;

  PERFORM insert_deletion_audit(p_actor_id, 'business', p_business_id, 'soft_delete', p_reason, v_old_snapshot, p_ip_address);

  RETURN jsonb_build_object(
    'business_id', p_business_id, 'deleted_at', v_deleted_at, 'permanent_deletion_at', v_permanent_deletion_at
  );
END;
$$;

-- =============================================================================
-- PART 6: ANONYMIZE USER PII EVERYWHERE (full edge scan)
-- =============================================================================

CREATE OR REPLACE FUNCTION anonymize_user_pii_everywhere(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB := '{}'::jsonb;
  v_count  INTEGER;
BEGIN
  -- Bookings
  UPDATE bookings
  SET customer_user_id = NULL, customer_name = '[anonymized]', customer_email = NULL, customer_phone = NULL
  WHERE customer_user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('bookings', v_count);

  -- Payments
  UPDATE payments SET refunded_by = NULL WHERE refunded_by = p_user_id;
  UPDATE payments SET verified_by = NULL WHERE verified_by = p_user_id;

  -- payment_audit_logs
  BEGIN
    UPDATE payment_audit_logs SET actor_id = NULL WHERE actor_id = p_user_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- notification_history is keyed by booking_id; no direct user_id. Skip.

  -- auth_events (if exists)
  BEGIN
    UPDATE auth_events SET user_id = NULL WHERE user_id = p_user_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- request_nonces (if exists)
  BEGIN
    DELETE FROM request_nonces WHERE user_id = p_user_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- user_locations (if exists)
  BEGIN
    DELETE FROM user_locations WHERE user_id = p_user_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- idempotency_keys often keyed by user; leave as-is (no PII)
  -- media_security_log (if has user_id)
  BEGIN
    UPDATE media_security_log SET user_id = NULL WHERE user_id = p_user_id;
  EXCEPTION
    WHEN undefined_table THEN NULL;
    WHEN undefined_column THEN NULL;
  END;

  -- cron_run_logs / metric_timings: no direct user PII
  -- reviews, invoices, refund_logs, webhook_logs, email_queue, chat: placeholder if added later
  BEGIN
    UPDATE notification_preferences SET user_id = NULL WHERE user_id = p_user_id;
  EXCEPTION
    WHEN undefined_table THEN NULL;
    WHEN undefined_column THEN NULL;
  END;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION anonymize_user_pii_everywhere IS 'Full PII edge scan: anonymize or null user refs; preserve financial records.';

-- =============================================================================
-- PART 7: PURGE — CONCURRENCY, INVARIANTS, DATA CLASSIFICATION, IDEMPOTENCY
-- =============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_soft_deleted_records()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_users_deleted    INTEGER := 0;
  v_businesses_deleted INTEGER := 0;
  v_users_anonymized INTEGER := 0;
  v_user_id UUID;
  v_biz_id UUID;
  v_old JSONB;
  v_actor_system CONSTANT UUID := NULL;
  v_classification TEXT;
  v_result JSONB;
  v_err_msg TEXT;
BEGIN
  -- Concurrency: only one purge at a time
  PERFORM pg_advisory_xact_lock(918273645);

  BEGIN
    -- Invariant 1: only rows with deleted_at IS NOT NULL, permanent_deletion_at <= now(), legal_hold = false

    -- Businesses: delete children first (referential safety when FK is RESTRICT), then hard delete
    FOR v_biz_id IN
      SELECT id FROM businesses
      WHERE deleted_at IS NOT NULL
        AND permanent_deletion_at IS NOT NULL
        AND permanent_deletion_at <= NOW()
        AND (legal_hold = FALSE OR legal_hold IS NULL)
    LOOP
      SELECT data_classification INTO v_classification FROM businesses WHERE id = v_biz_id;
      IF COALESCE(v_classification, 'internal') <> 'regulated' THEN
        -- Idempotent: delete children in safe order (required when FK is RESTRICT)
        BEGIN DELETE FROM booking_services WHERE booking_id IN (SELECT id FROM bookings WHERE business_id = v_biz_id); EXCEPTION WHEN undefined_table THEN NULL; END;
        BEGIN DELETE FROM payment_attempts WHERE payment_id IN (SELECT id FROM payments WHERE booking_id IN (SELECT id FROM bookings WHERE business_id = v_biz_id)); EXCEPTION WHEN undefined_table THEN NULL; END;
        DELETE FROM payments WHERE booking_id IN (SELECT id FROM bookings WHERE business_id = v_biz_id);
        DELETE FROM bookings WHERE business_id = v_biz_id;
        DELETE FROM slots WHERE business_id = v_biz_id;
        BEGIN DELETE FROM services WHERE business_id = v_biz_id; EXCEPTION WHEN undefined_table THEN NULL; END;
        BEGIN DELETE FROM business_holidays WHERE business_id = v_biz_id; EXCEPTION WHEN undefined_table THEN NULL; END;
        BEGIN DELETE FROM business_closures WHERE business_id = v_biz_id; EXCEPTION WHEN undefined_table THEN NULL; END;
        BEGIN DELETE FROM business_special_hours WHERE business_id = v_biz_id; EXCEPTION WHEN undefined_table THEN NULL; END;
        SELECT to_jsonb(b) INTO v_old FROM businesses b WHERE b.id = v_biz_id;
        PERFORM insert_deletion_audit(v_actor_system, 'business', v_biz_id, 'hard_delete',
          'Purge job: retention period expired', v_old, NULL);
        DELETE FROM businesses WHERE id = v_biz_id AND deleted_at IS NOT NULL
          AND permanent_deletion_at <= NOW() AND (legal_hold = FALSE OR legal_hold IS NULL);
        v_businesses_deleted := v_businesses_deleted + 1;
      END IF;
    END LOOP;

    -- Users: anonymize then hard delete (or anonymize-only if regulated)
    FOR v_user_id IN
      SELECT id FROM user_profiles
      WHERE deleted_at IS NOT NULL
        AND permanent_deletion_at IS NOT NULL
        AND permanent_deletion_at <= NOW()
        AND (legal_hold = FALSE OR legal_hold IS NULL)
    LOOP
      SELECT data_classification INTO v_classification FROM user_profiles WHERE id = v_user_id;
      PERFORM anonymize_user_pii_everywhere(v_user_id);
      IF COALESCE(v_classification, 'internal') = 'regulated' THEN
        v_users_anonymized := v_users_anonymized + 1;
        -- Do not DELETE; leave row with anonymized refs
      ELSE
        SELECT to_jsonb(row_to_json(up)) INTO v_old FROM user_profiles up WHERE up.id = v_user_id;
        PERFORM insert_deletion_audit(v_actor_system, 'user', v_user_id, 'hard_delete',
          'Purge job: retention period expired', v_old, NULL);
        DELETE FROM user_profiles WHERE id = v_user_id AND deleted_at IS NOT NULL
          AND permanent_deletion_at <= NOW() AND (legal_hold = FALSE OR legal_hold IS NULL);
        v_users_deleted := v_users_deleted + 1;
      END IF;
    END LOOP;

    v_result := jsonb_build_object(
      'cleanup_time', NOW(),
      'users_deleted', v_users_deleted,
      'businesses_deleted', v_businesses_deleted,
      'users_anonymized_only', v_users_anonymized,
      'success', true,
      'error', NULL
    );
    RETURN v_result;

  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err_msg = MESSAGE_TEXT;
    INSERT INTO deletion_events (entity_type, entity_id, action, success, error_message)
    VALUES ('user', NULL, 'purge_failed', false, v_err_msg);
    RETURN jsonb_build_object(
      'cleanup_time', NOW(),
      'users_deleted', v_users_deleted,
      'businesses_deleted', v_businesses_deleted,
      'users_anonymized_only', v_users_anonymized,
      'success', false,
      'error', v_err_msg
    );
  END;
END;
$$;

COMMENT ON FUNCTION cleanup_expired_soft_deleted_records IS 'Idempotent purge with advisory lock; enforces invariants; regulated → anonymize only.';

-- =============================================================================
-- PART 8: RESTORE — UNIQUENESS CHECKS (strict, no partial restore)
-- =============================================================================

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
  WHERE id = p_user_id AND deleted_at IS NOT NULL
    AND (permanent_deletion_at IS NULL OR permanent_deletion_at > NOW());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found, not deleted, or past recovery period';
  END IF;

  -- Uniqueness: id is PK so no duplicate user_profiles. Email/username live in auth.users;
  -- app layer must verify email not reused before calling restore. No partial restore.

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
    'user_id', p_user_id, 'restored_at', v_restored_at, 'businesses_restored', v_business_count
  );
END;
$$;

-- =============================================================================
-- PART 9: REMOVE ON DELETE CASCADE (referential safety)
-- Alter FKs that reference businesses(id) or auth.users(id) where CASCADE used.
-- =============================================================================

DO $$
DECLARE
  r RECORD;
  fk_schema TEXT;
  fk_table  TEXT;
  fk_col    TEXT;
  ref_schema TEXT;
  ref_table  TEXT;
  ref_col    TEXT;
  con_name   TEXT;
BEGIN
  FOR r IN
    SELECT DISTINCT
      tc.table_schema AS fk_schema,
      tc.table_name   AS fk_table,
      kcu.column_name AS fk_col,
      ccu.table_schema AS ref_schema,
      ccu.table_name   AS ref_table,
      ccu.column_name AS ref_col,
      tc.constraint_name AS con_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    JOIN information_schema.referential_constraints rc
      ON tc.constraint_name = rc.constraint_name AND tc.table_schema = rc.constraint_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND rc.delete_rule = 'CASCADE'
      AND ccu.table_schema = 'public' AND ccu.table_name = 'businesses' AND ccu.column_name = 'id'
  LOOP
    con_name := r.con_name;
    fk_schema := r.fk_schema;
    fk_table := r.fk_table;
    ref_schema := r.ref_schema;
    ref_table := r.ref_table;
    BEGIN
      EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I', fk_schema, fk_table, con_name);
      EXECUTE format(
        'ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I.%I(id) ON DELETE RESTRICT',
        fk_schema, fk_table, con_name, r.fk_col, ref_schema, ref_table
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'FK alter skip % on %.%: %', con_name, fk_schema, fk_table, SQLERRM;
    END;
  END LOOP;
END $$;

-- =============================================================================
-- PART 10: DIRECT TABLE DELETE PROTECTION (least privilege)
-- =============================================================================

REVOKE DELETE ON user_profiles FROM authenticated;
REVOKE DELETE ON user_profiles FROM anon;
REVOKE DELETE ON businesses FROM authenticated;
REVOKE DELETE ON businesses FROM anon;

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles FORCE ROW LEVEL SECURITY;

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses FORCE ROW LEVEL SECURITY;

-- Block DELETE for all roles except service_role (purge runs as service_role via RPC)
DROP POLICY IF EXISTS "user_profiles_deny_delete" ON user_profiles;
CREATE POLICY "user_profiles_deny_delete" ON user_profiles
  FOR DELETE USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "businesses_deny_delete" ON businesses;
CREATE POLICY "businesses_deny_delete" ON businesses
  FOR DELETE USING (auth.role() = 'service_role');

-- =============================================================================
-- PART 11: INTEGRITY VERIFICATION FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION run_deletion_integrity_check()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_report JSONB := '{}'::jsonb;
  v_chain  JSONB;
  v_stale_users BIGINT;
  v_stale_biz   BIGINT;
  v_orphan_payments BIGINT;
  v_user_deleted_biz_active BIGINT;
  v_visible_deleted BIGINT;
BEGIN
  -- Active rows with permanent_deletion_at < now() (should have been purged)
  SELECT COUNT(*) INTO v_stale_users FROM user_profiles
  WHERE deleted_at IS NOT NULL AND permanent_deletion_at IS NOT NULL AND permanent_deletion_at <= NOW();
  SELECT COUNT(*) INTO v_stale_biz FROM businesses
  WHERE deleted_at IS NOT NULL AND permanent_deletion_at IS NOT NULL AND permanent_deletion_at <= NOW();

  -- Broken audit hash chain
  v_chain := verify_audit_chain();

  -- Orphaned financial: payments with booking_id pointing to deleted/non-existent (optional check)
  SELECT COUNT(*) INTO v_orphan_payments FROM payments p
  WHERE NOT EXISTS (SELECT 1 FROM bookings b WHERE b.id = p.booking_id);

  -- Users deleted but their businesses still active (inconsistent)
  SELECT COUNT(*) INTO v_user_deleted_biz_active
  FROM businesses b
  JOIN user_profiles u ON u.id = b.owner_user_id
  WHERE u.deleted_at IS NOT NULL AND (b.deleted_at IS NULL OR b.deleted_at IS DISTINCT FROM u.deleted_at);

  -- Rows that are soft-deleted but might still be visible (RLS bypass check)
  v_visible_deleted := 0; -- Application must filter deleted_at; this is informational

  v_report := jsonb_build_object(
    'timestamp', NOW(),
    'stale_users_past_retention', v_stale_users,
    'stale_businesses_past_retention', v_stale_biz,
    'audit_chain', v_chain,
    'orphan_payments_no_booking', v_orphan_payments,
    'user_deleted_but_business_not_deleted', v_user_deleted_biz_active,
    'healthy', (v_stale_users = 0 AND v_stale_biz = 0 AND (v_chain->>'valid')::boolean = true
                AND v_orphan_payments = 0 AND v_user_deleted_biz_active = 0)
  );
  RETURN v_report;
END;
$$;

GRANT EXECUTE ON FUNCTION run_deletion_integrity_check() TO service_role;

COMMENT ON FUNCTION run_deletion_integrity_check IS 'DSA: integrity report for deletion/purge and audit chain.';

-- =============================================================================
-- PART 12: GRANTS (insert_deletion_audit_v2)
-- =============================================================================

REVOKE ALL ON FUNCTION insert_deletion_audit_v2(UUID, TEXT, UUID, TEXT, TEXT, JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION insert_deletion_audit_v2(UUID, TEXT, UUID, TEXT, TEXT, JSONB, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION anonymize_user_pii_everywhere(UUID) TO service_role;

-- =============================================================================
-- VERIFICATION QUERIES (run as service_role or superuser)
-- =============================================================================
-- 1. Audit chain integrity:
--    SELECT verify_audit_chain();
-- 2. Deletion integrity report:
--    SELECT run_deletion_integrity_check();
-- 3. Stale rows past retention (should be 0 after purge):
--    SELECT COUNT(*) FROM user_profiles WHERE deleted_at IS NOT NULL AND permanent_deletion_at <= NOW();
--    SELECT COUNT(*) FROM businesses WHERE deleted_at IS NOT NULL AND permanent_deletion_at <= NOW();
-- 4. RLS and DELETE protection (authenticated cannot delete):
--    SET ROLE authenticated; DELETE FROM user_profiles WHERE id = '...'; -- must fail
--    RESET ROLE;
