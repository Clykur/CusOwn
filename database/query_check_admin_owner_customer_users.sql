-- Run in Supabase SQL Editor to check admin, owner, and customer user details.
-- Auth flow uses user_profiles.user_type; user_roles is for RBAC.

-- =============================================================================
-- 1. All users with profile and role summary (auth.users + user_profiles + user_roles)
-- =============================================================================
SELECT
  u.id,
  u.email,
  u.created_at AS auth_created_at,
  p.user_type,
  p.full_name,
  p.created_at AS profile_created_at,
  p.updated_at AS profile_updated_at,
  (
    SELECT string_agg(r.name, ', ' ORDER BY r.name)
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = u.id
  ) AS roles
FROM auth.users u
LEFT JOIN public.user_profiles p ON p.id = u.id
ORDER BY p.user_type NULLS LAST, u.email;

-- =============================================================================
-- 2. Admins only (user_type = 'admin')
-- =============================================================================
SELECT
  u.id,
  u.email,
  p.full_name,
  p.user_type,
  p.updated_at
FROM auth.users u
JOIN public.user_profiles p ON p.id = u.id
WHERE p.user_type = 'admin'
ORDER BY u.email;

-- =============================================================================
-- 3. Owners only (user_type IN ('owner', 'both'))
-- =============================================================================
SELECT
  u.id,
  u.email,
  p.full_name,
  p.user_type,
  p.updated_at
FROM auth.users u
JOIN public.user_profiles p ON p.id = u.id
WHERE p.user_type IN ('owner', 'both')
ORDER BY u.email;

-- =============================================================================
-- 4. Customers only (user_type IN ('customer', 'both'))
-- =============================================================================
SELECT
  u.id,
  u.email,
  p.full_name,
  p.user_type,
  p.updated_at
FROM auth.users u
JOIN public.user_profiles p ON p.id = u.id
WHERE p.user_type IN ('customer', 'both')
ORDER BY u.email;

-- =============================================================================
-- 5. Users in auth.users with NO profile (will get one on first login via callback)
-- =============================================================================
SELECT
  u.id,
  u.email,
  u.created_at
FROM auth.users u
LEFT JOIN public.user_profiles p ON p.id = u.id
WHERE p.id IS NULL
ORDER BY u.email;
