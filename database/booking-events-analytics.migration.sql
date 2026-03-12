-- Booking lifecycle events for analytics dashboards.
-- SAFE to run; creates booking_events table used for created/cancelled/rescheduled metrics.

CREATE TABLE IF NOT EXISTS public.booking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('created', 'cancelled', 'rescheduled')),
  actor_type TEXT NOT NULL CHECK (actor_type IN ('customer', 'owner', 'system')),
  actor_id UUID,
  source TEXT NOT NULL DEFAULT 'api',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_events_booking
  ON public.booking_events (booking_id);

CREATE INDEX IF NOT EXISTS idx_booking_events_type_created
  ON public.booking_events (event_type, created_at DESC);

COMMENT ON TABLE public.booking_events IS
  'Booking lifecycle events (created/cancelled/rescheduled) for analytics; actor + source only, no PII.';

