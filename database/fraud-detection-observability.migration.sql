-- Migration: Fraud detection + observability layer.
-- Tables for risk metadata (no PII), IP–user sightings (hashed IP only). Observability metric seeds.
-- Safe to run once. Idempotent.

-- =============================================================================
-- 1. Fraud: IP–user sightings (hashed IP only; no PII)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.fraud_ip_user_sightings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash TEXT NOT NULL,
  user_id UUID NOT NULL,
  seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(ip_hash, user_id)
);

CREATE INDEX IF NOT EXISTS idx_fraud_ip_user_sightings_ip_hash
  ON public.fraud_ip_user_sightings(ip_hash);
CREATE INDEX IF NOT EXISTS idx_fraud_ip_user_sightings_user_id
  ON public.fraud_ip_user_sightings(user_id);
CREATE INDEX IF NOT EXISTS idx_fraud_ip_user_sightings_seen_at
  ON public.fraud_ip_user_sightings(seen_at DESC);

COMMENT ON TABLE public.fraud_ip_user_sightings IS 'Fraud: IP hash to user sightings for accounts_per_ip. No PII.';

-- =============================================================================
-- 2. Fraud: risk metadata per user (no PII)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.fraud_risk_metadata (
  user_id UUID PRIMARY KEY,
  risk_score INTEGER NOT NULL DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
  cancellation_rate_30d NUMERIC(5,4) NOT NULL DEFAULT 0,
  booking_attempt_rate NUMERIC(12,4) NOT NULL DEFAULT 0,
  accounts_per_ip INTEGER NOT NULL DEFAULT 0,
  flagged BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fraud_risk_metadata_flagged
  ON public.fraud_risk_metadata(flagged) WHERE flagged = true;
CREATE INDEX IF NOT EXISTS idx_fraud_risk_metadata_risk_score
  ON public.fraud_risk_metadata(risk_score DESC);

COMMENT ON TABLE public.fraud_risk_metadata IS 'Fraud: risk snapshot per user. No PII.';

-- =============================================================================
-- 3. Observability: seed counters (if metrics table exists)
-- =============================================================================
INSERT INTO public.metrics (metric, value) VALUES
  ('observability.booking_attempt_total', 0),
  ('observability.booking_success_total', 0),
  ('observability.cancellation_total', 0),
  ('observability.slot_conflict_total', 0),
  ('observability.cron_health_status', 1)
ON CONFLICT (metric) DO NOTHING;
