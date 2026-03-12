-- Payments hot-path indexes for API and cron performance.
-- idempotency_key and booking_id lookups; status+expires_at for expire job.

CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON public.payments(booking_id);

CREATE INDEX IF NOT EXISTS idx_payments_idempotency_key
  ON public.payments(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_status_expires_at
  ON public.payments(status, expires_at)
  WHERE status = 'initiated' AND expires_at IS NOT NULL;
