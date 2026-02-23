-- Migration: Allow multiple businesses per owner with the same WhatsApp number.
-- Owners can use one phone number for several businesses (e.g. multiple outlets).
-- Idempotent: safe to run multiple times.

-- Drop by standard name first
ALTER TABLE public.businesses
  DROP CONSTRAINT IF EXISTS businesses_whatsapp_number_key;

-- Drop any other unique constraint on whatsapp_number (e.g. different naming in some setups)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
    WHERE c.conrelid = 'public.businesses'::regclass
      AND c.contype = 'u'
      AND a.attname = 'whatsapp_number'
  LOOP
    EXECUTE format('ALTER TABLE public.businesses DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

-- Keep lookups by whatsapp_number fast
CREATE INDEX IF NOT EXISTS idx_businesses_whatsapp_number
  ON public.businesses(whatsapp_number);

COMMENT ON COLUMN public.businesses.whatsapp_number IS 'Contact number; multiple businesses may share the same number per owner.';
