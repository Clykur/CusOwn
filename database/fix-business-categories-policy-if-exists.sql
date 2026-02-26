-- Run separately: ensure business_categories RLS policy exists without error if already present.
-- Idempotent: drop then create.

DROP POLICY IF EXISTS "Public can read business_categories" ON public.business_categories;

CREATE POLICY "Public can read business_categories"
  ON public.business_categories FOR SELECT
  USING (true);
