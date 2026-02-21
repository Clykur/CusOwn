-- Migration: Booking state machine (directed graph; no hardcoded status checks)
-- booking_states + booking_state_transitions; validation via adjacency lookup.
-- Safe to run once. Idempotent where possible.

-- =============================================================================
-- PART 1: booking_states
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.booking_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_terminal BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE public.booking_states IS 'Allowed booking states; transitions in booking_state_transitions.';

INSERT INTO public.booking_states (id, name, is_terminal) VALUES
  ('20000000-0000-4000-8000-000000000001'::UUID, 'pending', false),
  ('20000000-0000-4000-8000-000000000002'::UUID, 'confirmed', false),
  ('20000000-0000-4000-8000-000000000003'::UUID, 'rejected', true),
  ('20000000-0000-4000-8000-000000000004'::UUID, 'cancelled', true)
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- PART 2: booking_state_transitions (from_state + event -> to_state)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.booking_state_transitions (
  from_state_id UUID NOT NULL REFERENCES public.booking_states(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  to_state_id UUID NOT NULL REFERENCES public.booking_states(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  PRIMARY KEY (from_state_id, event)
);

CREATE INDEX IF NOT EXISTS idx_booking_state_transitions_from ON public.booking_state_transitions(from_state_id);
CREATE INDEX IF NOT EXISTS idx_booking_state_transitions_to ON public.booking_state_transitions(to_state_id);

COMMENT ON TABLE public.booking_state_transitions IS 'Valid transitions: (from_state, event) -> to_state. Service layer uses adjacency map for O(1) validation.';

-- pending -> confirm -> confirmed
INSERT INTO public.booking_state_transitions (from_state_id, event, to_state_id)
SELECT f.id, 'confirm', t.id FROM public.booking_states f, public.booking_states t WHERE f.name = 'pending' AND t.name = 'confirmed'
ON CONFLICT (from_state_id, event) DO NOTHING;
-- pending -> reject -> rejected
INSERT INTO public.booking_state_transitions (from_state_id, event, to_state_id)
SELECT f.id, 'reject', t.id FROM public.booking_states f, public.booking_states t WHERE f.name = 'pending' AND t.name = 'rejected'
ON CONFLICT (from_state_id, event) DO NOTHING;
-- pending -> cancel -> cancelled
INSERT INTO public.booking_state_transitions (from_state_id, event, to_state_id)
SELECT f.id, 'cancel', t.id FROM public.booking_states f, public.booking_states t WHERE f.name = 'pending' AND t.name = 'cancelled'
ON CONFLICT (from_state_id, event) DO NOTHING;
-- pending -> expire -> cancelled
INSERT INTO public.booking_state_transitions (from_state_id, event, to_state_id)
SELECT f.id, 'expire', t.id FROM public.booking_states f, public.booking_states t WHERE f.name = 'pending' AND t.name = 'cancelled'
ON CONFLICT (from_state_id, event) DO NOTHING;
-- confirmed -> cancel -> cancelled
INSERT INTO public.booking_state_transitions (from_state_id, event, to_state_id)
SELECT f.id, 'cancel', t.id FROM public.booking_states f, public.booking_states t WHERE f.name = 'confirmed' AND t.name = 'cancelled'
ON CONFLICT (from_state_id, event) DO NOTHING;

ALTER TABLE public.booking_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_state_transitions ENABLE ROW LEVEL SECURITY;
