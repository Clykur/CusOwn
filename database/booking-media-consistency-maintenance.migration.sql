-- Booking + media consistency maintenance
-- SAFE and idempotent. Adds helper functions to:
-- - Cancel bookings that reference missing slots
-- - Soft-delete orphan media (business/profile) whose parent entity no longer exists
-- - Log corrections via audit_logs and increment metrics

-- 1) Fix bookings that reference missing slots by cancelling them as system.
CREATE OR REPLACE FUNCTION public.fix_bookings_missing_slots()
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_fixed_count INTEGER := 0;
BEGIN
  WITH inconsistent AS (
    SELECT b.id
    FROM public.bookings b
    LEFT JOIN public.slots s ON s.id = b.slot_id
    WHERE s.id IS NULL
  ),
  updated AS (
    UPDATE public.bookings b
    SET status = 'cancelled',
        cancelled_by = COALESCE(b.cancelled_by, 'system'),
        cancellation_reason = COALESCE(b.cancellation_reason, 'slot_missing'),
        cancelled_at = COALESCE(b.cancelled_at, NOW()),
        updated_at = NOW()
    WHERE b.id IN (SELECT id FROM inconsistent)
    RETURNING b.id
  )
  SELECT COUNT(*)::INTEGER INTO v_fixed_count FROM updated;

  IF v_fixed_count > 0 THEN
    INSERT INTO public.audit_logs (
      admin_user_id,
      action_type,
      entity_type,
      entity_id,
      old_data,
      new_data,
      description
    )
    VALUES (
      NULL,
      'data_correction',
      'system',
      NULL,
      NULL,
      jsonb_build_object('fixed_bookings_missing_slots', v_fixed_count),
      format('Maintenance: fixed %s bookings with missing slots', v_fixed_count)
    );
  END IF;

  RETURN v_fixed_count;
END;
$$;

COMMENT ON FUNCTION public.fix_bookings_missing_slots IS
  'Cancels bookings whose slot_id no longer exists; safe and idempotent.';

-- 2) Soft-delete orphan media and increment orphan cleanup metrics.
CREATE OR REPLACE FUNCTION public.cleanup_orphan_media(p_dry_run BOOLEAN DEFAULT TRUE)
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_orphan_ids UUID[];
  v_count INTEGER := 0;
BEGIN
  SELECT array_agg(m.id)::UUID[]
  INTO v_orphan_ids
  FROM public.media m
  LEFT JOIN public.businesses b
    ON m.entity_type = 'business' AND m.entity_id = b.id
  LEFT JOIN public.user_profiles up
    ON m.entity_type = 'profile' AND m.entity_id = up.id
  WHERE m.deleted_at IS NULL
    AND (
      (m.entity_type = 'business' AND b.id IS NULL) OR
      (m.entity_type = 'profile'  AND up.id IS NULL)
    );

  IF v_orphan_ids IS NULL OR array_length(v_orphan_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  v_count := array_length(v_orphan_ids, 1);

  IF NOT p_dry_run THEN
    UPDATE public.media
    SET deleted_at = COALESCE(deleted_at, NOW()),
        updated_at = NOW()
    WHERE id = ANY (v_orphan_ids);

    -- Increment media orphan cleanup metric (if function exists; ignore errors).
    BEGIN
      PERFORM public.increment_metric('media.orphan_cleanup.count', v_count);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    INSERT INTO public.audit_logs (
      admin_user_id,
      action_type,
      entity_type,
      entity_id,
      old_data,
      new_data,
      description
    )
    VALUES (
      NULL,
      'data_correction',
      'system',
      NULL,
      NULL,
      jsonb_build_object('orphan_media_soft_deleted', v_count),
      format('Maintenance: soft-deleted %s orphan media records', v_count)
    );
  END IF;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.cleanup_orphan_media IS
  'Finds media referencing missing entities. In dry-run mode returns count only; otherwise soft-deletes and logs corrections.';

