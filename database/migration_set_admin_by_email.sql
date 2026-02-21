-- Set specific emails as admin in user_profiles and user_roles.
-- Idempotent: safe to run multiple times. Users must exist in auth.users (sign in once).

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
-- karthiknaramala9949@gmail.com -> admin
-- =============================================================================
INSERT INTO public.user_roles (user_id, role_id)
SELECT u.id, r.id
FROM auth.users u
CROSS JOIN public.roles r
WHERE u.email = 'karthiknaramala9949@gmail.com' AND r.name = 'admin'
ON CONFLICT (user_id, role_id) DO NOTHING;

INSERT INTO public.user_profiles (id, user_type, full_name, created_at, updated_at)
SELECT u.id, 'admin', COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)), NOW(), NOW()
FROM auth.users u
WHERE u.email = 'karthiknaramala9949@gmail.com'
ON CONFLICT (id) DO UPDATE SET user_type = 'admin', updated_at = NOW();
