CREATE INDEX IF NOT EXISTS idx_bookings_partial_pending_confirmed_user_created
  ON public.bookings(customer_user_id, created_at DESC)
  WHERE status IN ('pending', 'confirmed') AND customer_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_partial_pending_confirmed_slot
  ON public.bookings(slot_id)
  WHERE status IN ('pending', 'confirmed');

CREATE INDEX IF NOT EXISTS idx_bookings_partial_pending_confirmed_business_created
  ON public.bookings(business_id, created_at DESC)
  WHERE status IN ('pending', 'confirmed');

CREATE INDEX IF NOT EXISTS idx_businesses_partial_active_category
  ON public.businesses(category, id)
  WHERE suspended = false AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_businesses_partial_active_city_area
  ON public.businesses(city, area, id)
  WHERE suspended = false AND deleted_at IS NULL AND city IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_businesses_partial_active_pincode
  ON public.businesses(pincode, id)
  WHERE suspended = false AND deleted_at IS NULL AND pincode IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_partial_recent_created_at
  ON public.audit_logs(created_at DESC)
  WHERE created_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_partial_recent_entity_type
  ON public.audit_logs(entity_type, created_at DESC)
  WHERE created_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_partial_recent_admin_user
  ON public.audit_logs(admin_user_id, created_at DESC)
  WHERE created_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_partial_recent_severity
  ON public.audit_logs(severity, created_at DESC)
  WHERE created_at IS NOT NULL;
