-- Migration: Add Success Metrics Support
-- Creates metrics for tracking success metrics

-- Support queries metric (tracked manually or via support system integration)
INSERT INTO metrics (metric, value) VALUES ('support.queries.reduction', 0)
ON CONFLICT (metric) DO NOTHING;

-- API request counter
INSERT INTO metrics (metric, value) VALUES ('api.requests.total', 0)
ON CONFLICT (metric) DO NOTHING;

-- API error counter
INSERT INTO metrics (metric, value) VALUES ('api.errors.total', 0)
ON CONFLICT (metric) DO NOTHING;

-- Health check timing
-- Already handled by metric_timings table
