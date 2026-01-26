CREATE TYPE payment_provider AS ENUM ('razorpay', 'stripe', 'cash');
CREATE TYPE payment_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'refunded', 'partially_refunded');

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
  provider payment_provider NOT NULL,
  provider_payment_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  status payment_status NOT NULL DEFAULT 'pending',
  payment_method TEXT,
  payment_intent_id TEXT,
  order_id TEXT,
  webhook_received_at TIMESTAMP WITH TIME ZONE,
  webhook_signature TEXT,
  webhook_payload_hash TEXT,
  refund_amount_cents INTEGER DEFAULT 0,
  refund_reason TEXT,
  refunded_at TIMESTAMP WITH TIME ZONE,
  refunded_by UUID REFERENCES auth.users(id),
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL,
  status payment_status NOT NULL,
  error_message TEXT,
  provider_response TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE bookings 
  ADD COLUMN IF NOT EXISTS payment_required BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS payment_type TEXT CHECK (payment_type IN ('full', 'deposit', 'cash'));

CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_provider_id ON payments(provider, provider_payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_idempotency ON payments(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_payment ON payment_attempts(payment_id);
