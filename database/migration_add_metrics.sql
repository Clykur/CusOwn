-- Migration: Add Metrics Tables (Supabase-native)
-- Stores metrics in PostgreSQL instead of Redis

CREATE TABLE IF NOT EXISTS metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric TEXT NOT NULL,
  value BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(metric)
);

CREATE TABLE IF NOT EXISTS metric_timings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_metrics_metric ON metrics(metric);
CREATE INDEX IF NOT EXISTS idx_metric_timings_metric_recorded ON metric_timings(metric, recorded_at DESC);

CREATE OR REPLACE FUNCTION increment_metric(metric_name TEXT, increment_value BIGINT DEFAULT 1)
RETURNS void AS $$
BEGIN
  INSERT INTO metrics (metric, value)
  VALUES (metric_name, increment_value)
  ON CONFLICT (metric) DO UPDATE
  SET value = metrics.value + increment_value,
      updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION record_timing(metric_name TEXT, duration_ms INTEGER)
RETURNS void AS $$
BEGIN
  INSERT INTO metric_timings (metric, duration_ms)
  VALUES (metric_name, duration_ms);
  
  DELETE FROM metric_timings
  WHERE metric = metric_name
  AND id NOT IN (
    SELECT id FROM metric_timings
    WHERE metric = metric_name
    ORDER BY recorded_at DESC
    LIMIT 1000
  );
END;
$$ LANGUAGE plpgsql;
