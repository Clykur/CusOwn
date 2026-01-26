CREATE TABLE IF NOT EXISTS request_nonces (
  nonce TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ip_address INET,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_nonces_expires ON request_nonces(expires_at);
CREATE INDEX IF NOT EXISTS idx_nonces_user ON request_nonces(user_id) WHERE user_id IS NOT NULL;
