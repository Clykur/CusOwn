-- Public read access to active services only
-- Allows customers to view active services of any business without auth
-- Note: Existing serviceService uses supabaseAdmin (bypasses RLS safely)

CREATE POLICY IF NOT EXISTS "Public can view active services"
ON services
FOR SELECT
TO public
USING (is_active = true);

COMMENT ON POLICY "Public can view active services" ON services IS 'Enable public read of active services for booking pages';
