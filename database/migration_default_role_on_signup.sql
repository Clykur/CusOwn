-- Migration: Ensure every new auth user gets default customer role at signup.
-- Safe for OAuth and email/password signups.

-- Ensure canonical role rows exist.
INSERT INTO public.roles (id, name, description)
VALUES
  ('00000000-0000-4000-8000-000000000001'::UUID, 'owner', 'Business owner: manage businesses and their bookings'),
  ('00000000-0000-4000-8000-000000000002'::UUID, 'customer', 'Customer: view and create own bookings'),
  ('00000000-0000-4000-8000-000000000003'::UUID, 'admin', 'Platform admin: full access')
ON CONFLICT (name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, user_type, full_name)
  VALUES (
    NEW.id,
    'customer',
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  )
  ON CONFLICT (id) DO UPDATE
  SET
    full_name = COALESCE(public.user_profiles.full_name, EXCLUDED.full_name),
    user_type = COALESCE(public.user_profiles.user_type, 'customer');

  INSERT INTO public.user_roles (user_id, role_id)
  VALUES (NEW.id, '00000000-0000-4000-8000-000000000002'::UUID)
  ON CONFLICT (user_id, role_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
