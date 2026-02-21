-- Migration: RLS-ready helper for role checks.
-- user_roles is the source of truth; user_profiles.user_type is kept in sync by app for existing RLS.
-- Safe to run once. Idempotent.

-- Helper for RLS policies: check if user has a role by name (customer, owner, admin).
CREATE OR REPLACE FUNCTION public.has_role(p_user_id UUID, p_role_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = p_user_id AND r.name = p_role_name
  );
$$;

COMMENT ON FUNCTION public.has_role(UUID, TEXT) IS 'RLS helper: true if user has the given role. Use in policies: has_role(auth.uid(), ''admin'').';
