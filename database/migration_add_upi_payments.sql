DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_provider') THEN
    ALTER TYPE payment_provider ADD VALUE IF NOT EXISTS 'upi';
  ELSE
    CREATE TYPE payment_provider AS ENUM ('razorpay', 'stripe', 'cash', 'upi');
  END IF;
END $$;

DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments') THEN
    ALTER TABLE payments
      ADD COLUMN IF NOT EXISTS payment_id TEXT UNIQUE,
      ADD COLUMN IF NOT EXISTS upi_payment_link TEXT,
      ADD COLUMN IF NOT EXISTS upi_qr_code TEXT,
      ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS transaction_id TEXT,
      ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES auth.users(id),
      ADD COLUMN IF NOT EXISTS verification_method TEXT CHECK (verification_method IN ('webhook', 'manual', 'polling')),
      ADD COLUMN IF NOT EXISTS upi_app_used TEXT,
      ADD COLUMN IF NOT EXISTS failure_reason TEXT,
      ADD COLUMN IF NOT EXISTS attempt_count INTEGER DEFAULT 0;
  END IF;
END $$;

DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
    BEGIN
      ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'initiated';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'expired';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  ELSE
    CREATE TYPE payment_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'refunded', 'partially_refunded', 'initiated', 'expired');
  END IF;
END $$;

DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments') THEN
    CREATE INDEX IF NOT EXISTS idx_payments_payment_id ON payments(payment_id);
    CREATE INDEX IF NOT EXISTS idx_payments_transaction_id ON payments(transaction_id);
    CREATE INDEX IF NOT EXISTS idx_payments_expires_at ON payments(expires_at) WHERE expires_at IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_payments_booking_status ON payments(booking_id, status);
  END IF;
END $$;

DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments') THEN
    CREATE TABLE IF NOT EXISTS payment_audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
      actor_id UUID REFERENCES auth.users(id),
      actor_type TEXT NOT NULL CHECK (actor_type IN ('customer', 'owner', 'admin', 'system')),
      action TEXT NOT NULL,
      from_status payment_status,
      to_status payment_status,
      reason TEXT,
      metadata JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_payment_audit_payment ON payment_audit_logs(payment_id);
    CREATE INDEX IF NOT EXISTS idx_payment_audit_actor ON payment_audit_logs(actor_id);
    CREATE INDEX IF NOT EXISTS idx_payment_audit_created ON payment_audit_logs(created_at);
  END IF;
END $$;
