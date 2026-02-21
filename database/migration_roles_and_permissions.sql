-- Migration: Role-based access (roles, permissions, role_permissions, user_roles)
-- No hardcoded role strings in application; permission lookup is O(1) via graph.
-- Safe to run once. Idempotent where possible.
-- Run before any code that uses permission service.

-- =============================================================================
-- PART 1: roles
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE public.roles IS 'Roles for RBAC. No hardcoded checks; use permission lookup.';

INSERT INTO public.roles (id, name, description) VALUES
  ('00000000-0000-4000-8000-000000000001'::UUID, 'owner', 'Business owner: manage businesses and their bookings'),
  ('00000000-0000-4000-8000-000000000002'::UUID, 'customer', 'Customer: view and create own bookings'),
  ('00000000-0000-4000-8000-000000000003'::UUID, 'admin', 'Platform admin: full access')
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- PART 2: permissions
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE public.permissions IS 'Permissions: resource:action. Lookup by name for O(1) check.';

INSERT INTO public.permissions (id, name, resource, action) VALUES
  ('10000000-0000-4000-8000-000000000001'::UUID, 'admin:access', 'admin', 'access'),
  ('10000000-0000-4000-8000-000000000002'::UUID, 'businesses:read', 'businesses', 'read'),
  ('10000000-0000-4000-8000-000000000003'::UUID, 'businesses:write', 'businesses', 'write'),
  ('10000000-0000-4000-8000-000000000004'::UUID, 'bookings:read', 'bookings', 'read'),
  ('10000000-0000-4000-8000-000000000005'::UUID, 'bookings:write', 'bookings', 'write'),
  ('10000000-0000-4000-8000-000000000006'::UUID, 'bookings:confirm', 'bookings', 'confirm'),
  ('10000000-0000-4000-8000-000000000007'::UUID, 'bookings:reject', 'bookings', 'reject'),
  ('10000000-0000-4000-8000-000000000008'::UUID, 'slots:read', 'slots', 'read'),
  ('10000000-0000-4000-8000-000000000009'::UUID, 'slots:write', 'slots', 'write'),
  ('10000000-0000-4000-8000-00000000000a'::UUID, 'audit:read', 'audit', 'read'),
  ('10000000-0000-4000-8000-00000000000b'::UUID, 'users:read', 'users', 'read')
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- PART 3: role_permissions (which role has which permission)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  PRIMARY KEY (role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON public.role_permissions(permission_id);

-- owner: businesses + bookings + slots for own scope (enforced in API)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'owner' AND p.name IN ('businesses:read', 'businesses:write', 'bookings:read', 'bookings:write', 'bookings:confirm', 'bookings:reject', 'slots:read', 'slots:write')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- customer: own bookings read/write
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'customer' AND p.name IN ('bookings:read', 'bookings:write', 'slots:read')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- admin: all
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- =============================================================================
-- PART 4: user_roles (user -> role assignment; no email-based bootstrap)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  PRIMARY KEY (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role_id);

COMMENT ON TABLE public.user_roles IS 'User-role assignment. Admin: insert into user_roles (user_id, role_id) with admin role_id.';

-- Migrate existing user_profiles.user_type to user_roles (one-time backfill)
INSERT INTO public.user_roles (user_id, role_id)
SELECT up.id, r.id FROM public.user_profiles up
JOIN public.roles r ON r.name = 'owner' WHERE up.user_type = 'owner'
ON CONFLICT (user_id, role_id) DO NOTHING;
INSERT INTO public.user_roles (user_id, role_id)
SELECT up.id, r.id FROM public.user_profiles up
JOIN public.roles r ON r.name = 'customer' WHERE up.user_type = 'customer'
ON CONFLICT (user_id, role_id) DO NOTHING;
INSERT INTO public.user_roles (user_id, role_id)
SELECT up.id, r.id FROM public.user_profiles up
JOIN public.roles r ON r.name = 'owner' WHERE up.user_type = 'both'
ON CONFLICT (user_id, role_id) DO NOTHING;
INSERT INTO public.user_roles (user_id, role_id)
SELECT up.id, r.id FROM public.user_profiles up
JOIN public.roles r ON r.name = 'customer' WHERE up.user_type = 'both'
ON CONFLICT (user_id, role_id) DO NOTHING;
INSERT INTO public.user_roles (user_id, role_id)
SELECT up.id, r.id FROM public.user_profiles up
JOIN public.roles r ON r.name = 'admin' WHERE up.user_type = 'admin'
ON CONFLICT (user_id, role_id) DO NOTHING;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
