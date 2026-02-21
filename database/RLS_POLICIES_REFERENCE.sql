-- =============================================================================
-- RLS POLICIES REFERENCE (production-grade)
-- =============================================================================
-- This file documents the intended RLS state. Apply migrations in order;
-- this is the canonical reference for default-deny, no public write, admin override.
--
-- Tables: user_profiles, businesses, bookings, slots, audit_logs (and others
-- with RLS enabled and service-role-only insert where no policies grant write).
-- =============================================================================

-- Ensure RLS is enabled and FORCE so table owner cannot bypass
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- user_profiles: own row only; admin can view/update all
-- (Policies use (SELECT auth.uid()) for single evaluation - see migration_supabase_linter_remediation.sql)
-- SELECT: own id OR is_admin_user()
-- INSERT: own id
-- UPDATE: own id OR is_admin_user()
-- No public write.

-- businesses: owner owns row; admin view/update all
-- SELECT: owner_user_id = auth.uid() OR admin
-- UPDATE: owner_user_id = auth.uid() OR admin
-- INSERT: owner_user_id = auth.uid()
-- No public write.

-- bookings: customer sees own; owner sees business bookings; admin sees all
-- SELECT: customer_user_id = auth.uid() OR business.owner_user_id = auth.uid() OR admin
-- UPDATE: same
-- INSERT/DELETE: via service role only (no policy = deny for anon/authenticated)

-- slots: public read for available/reserved; owner read/update own; admin all
-- SELECT: status IN ('available','reserved') OR owner OR admin
-- UPDATE: owner OR admin
-- INSERT/DELETE: service role only

-- audit_logs: only admins can SELECT; only service role can INSERT
-- SELECT: admin only
-- INSERT: no policy for anon/authenticated (service role only)

-- Service role (supabaseAdmin) bypasses RLS. Use only server-side; never expose.
