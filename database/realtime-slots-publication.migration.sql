-- Enable Supabase Realtime for slots table so clients can subscribe to slot changes per business_id.
-- Run in Supabase SQL Editor or migration runner. Requires Realtime enabled in project.
-- After this, use filter business_id=eq.<uuid> when subscribing to postgres_changes on table 'slots'.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'slots'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.slots;
  END IF;
END $$;

COMMENT ON TABLE public.slots IS 'Realtime: clients subscribe with filter business_id=eq.<id> for live slot reserved/confirmed/released updates.';
