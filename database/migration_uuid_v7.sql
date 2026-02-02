-- Migration: Switch to UUID v7 for all new primary keys (RFC 9562)
-- Time-ordered UUIDs improve index locality and sortability.
-- Existing rows keep their UUID v4 values; only new inserts get v7.
-- Do NOT alter user_profiles: id comes from auth.users (Supabase Auth).

-- =============================================================================
-- 1. Create uuid_generate_v7() in PostgreSQL
-- =============================================================================
-- Layout: 48-bit unix_ts_ms | 4-bit version (7) | 12-bit rand_a | 2-bit variant | 62-bit rand_b

CREATE OR REPLACE FUNCTION public.uuid_generate_v7()
RETURNS UUID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  unix_ts_ms BIGINT;
  buf BYTEA;
  hex TEXT;
BEGIN
  unix_ts_ms := (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::BIGINT;
  -- Keep 48 bits (truncate if needed; valid until year 10889)
  unix_ts_ms := unix_ts_ms & (BIGINT '281474976710655'); -- 2^48 - 1

  buf := gen_random_bytes(16);

  -- Bytes 0-5: big-endian 48-bit timestamp
  buf := set_byte(buf, 0, (unix_ts_ms >> 40) & 255);
  buf := set_byte(buf, 1, (unix_ts_ms >> 32) & 255);
  buf := set_byte(buf, 2, (unix_ts_ms >> 24) & 255);
  buf := set_byte(buf, 3, (unix_ts_ms >> 16) & 255);
  buf := set_byte(buf, 4, (unix_ts_ms >> 8) & 255);
  buf := set_byte(buf, 5, unix_ts_ms & 255);

  -- Byte 6: version 7 (0x07) in high nibble, keep low nibble random
  buf := set_byte(buf, 6, (7 << 4) | (get_byte(buf, 6) & 15));

  -- Byte 8: variant 10xx (RFC 4122)
  buf := set_byte(buf, 8, (get_byte(buf, 8) & 63) | 128);

  hex := encode(buf, 'hex');
  RETURN (
    substring(hex from 1 for 8) || '-' ||
    substring(hex from 9 for 4) || '-' ||
    substring(hex from 13 for 4) || '-' ||
    substring(hex from 17 for 4) || '-' ||
    substring(hex from 21 for 12)
  )::UUID;
END;
$$;

COMMENT ON FUNCTION public.uuid_generate_v7() IS 'UUID v7: time-ordered, RFC 9562. Use for new primary keys.';

-- =============================================================================
-- 2. Set default to uuid_generate_v7() for all tables with id UUID
-- =============================================================================
-- Skip: user_profiles (id from auth.users), request_nonces (no id column).
-- Only alters tables that exist (safe if some migrations not yet run).

DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'businesses', 'slots', 'bookings', 'services', 'booking_services',
    'audit_logs', 'metrics', 'metric_timings', 'booking_reminders',
    'business_closures', 'business_special_hours', 'business_holidays',
    'notification_preferences', 'notification_history',
    'payments', 'payment_attempts', 'payment_audit_logs'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns c
               JOIN information_schema.tables tb ON c.table_schema = tb.table_schema AND c.table_name = tb.table_name
               WHERE c.table_schema = 'public' AND c.table_name = t AND c.column_name = 'id') THEN
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN id SET DEFAULT public.uuid_generate_v7()', t);
    END IF;
  END LOOP;
END;
$$;
