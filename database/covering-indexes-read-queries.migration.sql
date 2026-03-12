CREATE INDEX IF NOT EXISTS idx_bookings_covering_business_list
  ON public.bookings(business_id, created_at DESC)
  INCLUDE (id, status, slot_id);

CREATE INDEX IF NOT EXISTS idx_bookings_covering_customer_list
  ON public.bookings(customer_user_id, created_at DESC)
  INCLUDE (id, status, slot_id)
  WHERE customer_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_covering_status_list
  ON public.bookings(status, created_at DESC)
  INCLUDE (id, business_id, slot_id);

CREATE INDEX IF NOT EXISTS idx_businesses_covering_discovery_category
  ON public.businesses(category, id)
  INCLUDE (salon_name, rating_avg, created_at)
  WHERE suspended = false AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_businesses_covering_discovery_city
  ON public.businesses(city, id)
  INCLUDE (salon_name, rating_avg, created_at)
  WHERE suspended = false AND deleted_at IS NULL AND city IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_businesses_covering_discovery_pincode
  ON public.businesses(pincode, id)
  INCLUDE (salon_name, rating_avg, created_at)
  WHERE suspended = false AND deleted_at IS NULL AND pincode IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_covering_admin_dashboard
  ON public.audit_logs(admin_user_id, created_at DESC)
  INCLUDE (id, action_type, entity_type, entity_id, severity);

CREATE INDEX IF NOT EXISTS idx_audit_logs_covering_entity_type
  ON public.audit_logs(entity_type, created_at DESC)
  INCLUDE (id, action_type, entity_id, severity);

CREATE INDEX IF NOT EXISTS idx_audit_logs_covering_severity
  ON public.audit_logs(severity, created_at DESC)
  INCLUDE (id, action_type, entity_type, entity_id);
