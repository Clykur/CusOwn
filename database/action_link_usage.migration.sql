CREATE TABLE IF NOT EXISTS public.action_link_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT uq_action_link_usage_booking_action_token UNIQUE (booking_id, action_type, token_hash)
);

CREATE INDEX IF NOT EXISTS idx_action_link_usage_lookup ON public.action_link_usage(booking_id, action_type, token_hash);

ALTER TABLE public.action_link_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS action_link_usage_select_service_role ON public.action_link_usage;
CREATE POLICY action_link_usage_select_service_role ON public.action_link_usage
  FOR SELECT TO service_role USING (true);

DROP POLICY IF EXISTS action_link_usage_insert_service_role ON public.action_link_usage;
CREATE POLICY action_link_usage_insert_service_role ON public.action_link_usage
  FOR INSERT TO service_role WITH CHECK (true);
