-- Migration: Admin users table
-- Source of truth for admin access.
-- Uses boolean `is_admin` so each email can be enabled/disabled cleanly.
-- No UI: manage via SQL. RLS allows only active admins to manage this table.

-- =============================================================================
-- 1. Create table
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'admin',
  is_admin BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.admin_users IS 'Allowed admin emails. Only these users get admin access. Manage via SQL.';

-- Validation and normalization safety (idempotent)
ALTER TABLE public.admin_users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT TRUE;
UPDATE public.admin_users SET email = LOWER(TRIM(email));
UPDATE public.admin_users SET is_admin = TRUE WHERE is_admin IS NULL;
ALTER TABLE public.admin_users
  DROP CONSTRAINT IF EXISTS admin_users_email_nonempty_check;
ALTER TABLE public.admin_users
  ADD CONSTRAINT admin_users_email_nonempty_check CHECK (LENGTH(TRIM(email)) > 3);

-- =============================================================================
-- 2. Seed initial admins (run with service role so RLS does not block)
-- =============================================================================
INSERT INTO public.admin_users (email, role, is_admin)
VALUES
  ('chinnuk0521@gmail.com', 'admin', TRUE),
  ('karthiknaramala9949@gmail.com', 'admin', TRUE)
ON CONFLICT (email) DO UPDATE
SET role = EXCLUDED.role, is_admin = EXCLUDED.is_admin, updated_at = NOW();

-- =============================================================================
-- 3. RLS: only current users whose email is active admin can read/write (case-insensitive)
-- =============================================================================
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin users: only listed admins can manage" ON public.admin_users;
CREATE POLICY "Admin users: only listed admins can manage" ON public.admin_users
  FOR ALL
  USING (
    LOWER((SELECT email FROM auth.users WHERE id = auth.uid()))
    IN (
      SELECT LOWER(email)
      FROM public.admin_users
      WHERE is_admin = TRUE
    )
  )
  WITH CHECK (
    LOWER((SELECT email FROM auth.users WHERE id = auth.uid()))
    IN (
      SELECT LOWER(email)
      FROM public.admin_users
      WHERE is_admin = TRUE
    )
  );

-- Service role can always manage (for migrations and server-side sync)
-- RLS is bypassed for the service role key by default in Supabase.

-- =============================================================================
-- 4. Indexes for lookups
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON public.admin_users(email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_users_email_lower ON public.admin_users((LOWER(email)));
CREATE INDEX IF NOT EXISTS idx_admin_users_is_admin ON public.admin_users(is_admin);

-- =============================================================================
-- Example SQL to add / disable / delete admins (run as active admin or service role)
-- =============================================================================
-- Add admin:
--   INSERT INTO public.admin_users (email, role, is_admin) VALUES ('newadmin@example.com', 'admin', TRUE);
-- Disable admin without deleting row:
--   UPDATE public.admin_users SET is_admin = FALSE, updated_at = NOW() WHERE email = 'old@example.com';
-- Re-enable admin:
--   UPDATE public.admin_users SET is_admin = TRUE, updated_at = NOW() WHERE email = 'user@example.com';
-- Delete row:
--   DELETE FROM public.admin_users WHERE email = 'old@example.com';
-- Change role label (optional metadata):
--   UPDATE public.admin_users SET role = 'admin', updated_at = NOW() WHERE email = 'user@example.com';
-- List admins:
--   SELECT id, email, role, is_admin, created_at, updated_at FROM public.admin_users ORDER BY email;
