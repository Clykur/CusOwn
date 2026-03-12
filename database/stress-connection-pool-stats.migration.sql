CREATE OR REPLACE FUNCTION get_connection_pool_stats()
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT json_build_object(
    'active', (SELECT count(*)::int FROM pg_stat_activity WHERE state = 'active'),
    'idle', (SELECT count(*)::int FROM pg_stat_activity WHERE state = 'idle'),
    'waiting', (SELECT count(*)::int FROM pg_stat_activity WHERE state = 'active' AND wait_event_type IS NOT NULL),
    'max_connections', (SELECT setting::int FROM pg_settings WHERE name = 'max_connections')
  );
$$;
