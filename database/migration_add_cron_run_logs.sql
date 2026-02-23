-- Migration: Add cron_run_logs table for admin cron monitoring.
-- SAFE to run; idempotent.

CREATE TABLE IF NOT EXISTS cron_run_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  duration_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cron_run_logs_job_name ON cron_run_logs(job_name);
CREATE INDEX IF NOT EXISTS idx_cron_run_logs_started_at ON cron_run_logs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_cron_run_logs_status ON cron_run_logs(status);

ALTER TABLE cron_run_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view cron_run_logs" ON cron_run_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

CREATE POLICY "Service can insert cron_run_logs" ON cron_run_logs
  FOR INSERT WITH CHECK (true);

COMMENT ON TABLE cron_run_logs IS 'Admin cron job execution log for monitoring; inserted by API cron routes.';
