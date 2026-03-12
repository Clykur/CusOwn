CREATE INDEX IF NOT EXISTS idx_bookings_customer_user_id_created_at
  ON public.bookings(customer_user_id, created_at DESC)
  WHERE customer_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_slot_id
  ON public.bookings(slot_id);

CREATE INDEX IF NOT EXISTS idx_bookings_status_created_at
  ON public.bookings(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_businesses_city_area_pincode_active
  ON public.businesses(city, area, pincode, id)
  WHERE suspended = false
    AND deleted_at IS NULL
    AND city IS NOT NULL
    AND area IS NOT NULL
    AND pincode IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_businesses_created_at
  ON public.businesses(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type_entity_id_created_at
  ON public.audit_logs(entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_user_id_created_at
  ON public.audit_logs(admin_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_severity_created_at
  ON public.audit_logs(severity, created_at DESC);

CREATE OR REPLACE FUNCTION public.has_index(p_index_name text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = p_index_name
  );
$$;

