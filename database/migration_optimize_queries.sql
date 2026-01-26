-- Migration: PostgreSQL Query Optimizations
-- Adds indexes and optimizations for read-heavy queries

-- Composite index for business lookups by booking_link (most common query)
CREATE INDEX IF NOT EXISTS idx_businesses_booking_link_optimized ON businesses(booking_link) INCLUDE (id, salon_name, owner_name, whatsapp_number, opening_time, closing_time, slot_duration, address, location, category, qr_code, owner_user_id, created_at, updated_at);

-- Index for booking lookups by booking_id (public status page)
CREATE INDEX IF NOT EXISTS idx_bookings_booking_id_optimized ON bookings(booking_id) INCLUDE (id, business_id, slot_id, customer_name, customer_phone, status, cancelled_by, cancellation_reason, cancelled_at, customer_user_id, created_at, updated_at);

-- Index for owner businesses lookup
CREATE INDEX IF NOT EXISTS idx_businesses_owner_user_id ON businesses(owner_user_id) WHERE owner_user_id IS NOT NULL;

-- Index for customer bookings lookup
CREATE INDEX IF NOT EXISTS idx_bookings_customer_user_id ON bookings(customer_user_id) WHERE customer_user_id IS NOT NULL;

-- Partial index for active bookings (most common query)
CREATE INDEX IF NOT EXISTS idx_bookings_active ON bookings(business_id, created_at DESC) WHERE status IN ('pending', 'confirmed');

-- Partial index for confirmed bookings (reminder queries)
CREATE INDEX IF NOT EXISTS idx_bookings_confirmed ON bookings(id, status, created_at) WHERE status = 'confirmed';

-- Index for slot queries with date range
CREATE INDEX IF NOT EXISTS idx_slots_business_date_status_optimized ON slots(business_id, date, status, start_time) WHERE status IN ('available', 'reserved');

-- Analyze tables for query planner
ANALYZE businesses;
ANALYZE bookings;
ANALYZE slots;
