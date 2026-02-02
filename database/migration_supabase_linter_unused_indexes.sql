-- Migration: Supabase Linter – Unused Indexes (OPTIONAL)
-- Fixes: linter "Unused Index" (0005_unused_index) suggestions.
-- These indexes have not been used; dropping them reduces write cost and storage.
-- Re-add any index later if you add queries that filter/sort by that column.
-- Safe to run once. Idempotent (IF EXISTS). Run after migration_supabase_linter_remediation.sql.
-- In production, consider: DROP INDEX CONCURRENTLY index_name; (one at a time, outside a transaction).

-- businesses
DROP INDEX IF EXISTS public.idx_businesses_category_location;
DROP INDEX IF EXISTS public.idx_businesses_city_area;
DROP INDEX IF EXISTS public.idx_businesses_pincode;
DROP INDEX IF EXISTS public.idx_businesses_booking_link_optimized;

-- booking_reminders
DROP INDEX IF EXISTS public.idx_booking_reminders_status;
DROP INDEX IF EXISTS public.idx_booking_reminders_scheduled_at;

-- booking_services
DROP INDEX IF EXISTS public.idx_booking_services_service;

-- bookings
DROP INDEX IF EXISTS public.idx_bookings_confirmed;
DROP INDEX IF EXISTS public.idx_bookings_cancelled_by;
DROP INDEX IF EXISTS public.idx_bookings_cancelled_at;
DROP INDEX IF EXISTS public.idx_bookings_rescheduled_at;
DROP INDEX IF EXISTS public.idx_bookings_no_show;
DROP INDEX IF EXISTS public.idx_bookings_no_show_marked_at;

-- services
DROP INDEX IF EXISTS public.idx_services_active;

-- audit_logs
DROP INDEX IF EXISTS public.idx_audit_logs_admin_user_id;
DROP INDEX IF EXISTS public.idx_audit_logs_action_type;
DROP INDEX IF EXISTS public.idx_audit_logs_entity_type;

-- metrics
DROP INDEX IF EXISTS public.idx_metrics_metric;

-- notification_history
DROP INDEX IF EXISTS public.idx_notification_history_sent_at;
DROP INDEX IF EXISTS public.idx_notification_history_type;
DROP INDEX IF EXISTS public.idx_notification_history_status;

-- notification_preferences
DROP INDEX IF EXISTS public.idx_notification_preferences_user;
DROP INDEX IF EXISTS public.idx_notification_preferences_phone;

-- request_nonces
DROP INDEX IF EXISTS public.idx_nonces_user;

-- payments
DROP INDEX IF EXISTS public.idx_payments_booking;
DROP INDEX IF EXISTS public.idx_payments_provider_id;
DROP INDEX IF EXISTS public.idx_payments_idempotency;
DROP INDEX IF EXISTS public.idx_payments_payment_id;
DROP INDEX IF EXISTS public.idx_payments_transaction_id;
DROP INDEX IF EXISTS public.idx_payments_expires_at;

-- payment_audit_logs
DROP INDEX IF EXISTS public.idx_payment_audit_actor;
DROP INDEX IF EXISTS public.idx_payment_audit_created;
