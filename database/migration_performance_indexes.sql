-- Migration: Additional indexes for API performance (admin metrics, list queries)
-- Safe to run once. Complements migration_optimize_queries.sql.

-- Admin metrics: count by status and time range
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON bookings(created_at);
CREATE INDEX IF NOT EXISTS idx_bookings_business_id ON bookings(business_id);

-- Admin metrics: user_profiles by user_type (count owners/customers)
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_type ON user_profiles(user_type);

-- Businesses: suspended filter and created_at for growth
CREATE INDEX IF NOT EXISTS idx_businesses_suspended ON businesses(suspended) WHERE suspended IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_businesses_created_at ON businesses(created_at);

-- Audit logs: common filters
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON audit_logs(action_type);

ANALYZE bookings;
ANALYZE businesses;
ANALYZE user_profiles;
