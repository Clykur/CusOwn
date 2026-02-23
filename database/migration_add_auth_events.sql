-- Migration: Add auth_events table for optional admin auth event logging.
-- SAFE to run; idempotent. No tokens or secrets stored.

CREATE TABLE IF NOT EXISTS auth_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN ('login_success', 'login_failed', 'logout')),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email_hash TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_events_event_type ON auth_events(event_type);
CREATE INDEX IF NOT EXISTS idx_auth_events_user_id ON auth_events(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_events_created_at ON auth_events(created_at DESC);

ALTER TABLE auth_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view auth_events" ON auth_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

CREATE POLICY "System can insert auth_events" ON auth_events
  FOR INSERT WITH CHECK (true);

COMMENT ON TABLE auth_events IS 'Auth event log for admin; no tokens or raw PII.';
