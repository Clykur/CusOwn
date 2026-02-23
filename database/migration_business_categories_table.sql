-- Migration: Business categories (available services) as a table.
-- Used for "Business type" dropdown; only active categories are shown. No hardcoded list in app.
-- Idempotent: safe to run multiple times.

CREATE TABLE IF NOT EXISTS public.business_categories (
  value TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_business_categories_active_order
  ON public.business_categories(is_active, sort_order, label)
  WHERE is_active = true;

COMMENT ON TABLE public.business_categories IS 'Available business types for create-business; list is dynamic, not hardcoded.';

-- Seed initial categories (ignore if already present)
INSERT INTO public.business_categories (value, label, sort_order)
VALUES
  ('salon', 'Salon', 10),
  ('clinic', 'Clinic', 20),
  ('gym', 'Gym', 30),
  ('tutor', 'Tutor', 40),
  ('repair', 'Repair', 50),
  ('consultant', 'Consultant', 60)
ON CONFLICT (value) DO NOTHING;
