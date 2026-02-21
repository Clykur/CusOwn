-- Migration: Seed user_roles and user_profiles by email (no code-level role assignment).
-- Run after migration_roles_and_permissions.sql. Users must exist in auth.users (sign in once via OAuth).
-- Idempotent: safe to run multiple times.

-- =============================================================================
-- chinnuk0521@gmail.com -> admin
-- =============================================================================
INSERT INTO public.user_roles (user_id, role_id)
SELECT u.id, r.id
FROM auth.users u
CROSS JOIN public.roles r
WHERE u.email = 'chinnuk0521@gmail.com' AND r.name = 'admin'
ON CONFLICT (user_id, role_id) DO NOTHING;

INSERT INTO public.user_profiles (id, user_type, full_name, created_at, updated_at)
SELECT u.id, 'admin', COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)), NOW(), NOW()
FROM auth.users u
WHERE u.email = 'chinnuk0521@gmail.com'
ON CONFLICT (id) DO UPDATE SET user_type = 'admin', updated_at = NOW();

-- =============================================================================
-- chandukalluru143@gmail.com -> customer + owner (both)
-- =============================================================================
INSERT INTO public.user_roles (user_id, role_id)
SELECT u.id, r.id
FROM auth.users u
CROSS JOIN public.roles r
WHERE u.email = 'chandukalluru143@gmail.com' AND r.name = 'customer'
ON CONFLICT (user_id, role_id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role_id)
SELECT u.id, r.id
FROM auth.users u
CROSS JOIN public.roles r
WHERE u.email = 'chandukalluru143@gmail.com' AND r.name = 'owner'
ON CONFLICT (user_id, role_id) DO NOTHING;

INSERT INTO public.user_profiles (id, user_type, full_name, created_at, updated_at)
SELECT u.id, 'both', COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)), NOW(), NOW()
FROM auth.users u
WHERE u.email = 'chandukalluru143@gmail.com'
ON CONFLICT (id) DO UPDATE SET user_type = 'both', updated_at = NOW();

COMMENT ON TABLE public.user_roles IS 'User-role assignment. Manage via DB only; no code-level role bootstrap.';
