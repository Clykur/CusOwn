-- Migration: Add admin_note to user_profiles for admin-only notes (future reference).
-- Safe: nullable column; only admins can update via existing RLS.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS admin_note TEXT;

COMMENT ON COLUMN public.user_profiles.admin_note IS 'Admin-only note/description for future reference. Not visible to the user.';
