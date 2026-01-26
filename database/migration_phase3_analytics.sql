-- Migration: Phase 3 - Analytics & Rescheduling & No-show Support

-- Rescheduling support
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS rescheduled_from_booking_id UUID REFERENCES bookings(id);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS rescheduled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS rescheduled_by TEXT CHECK (rescheduled_by IN ('customer', 'owner'));
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reschedule_reason TEXT;

-- No-show support
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS no_show BOOLEAN DEFAULT FALSE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS no_show_marked_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS no_show_marked_by TEXT CHECK (no_show_marked_by IN ('owner', 'system'));

-- Notification preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_phone TEXT,
  email_enabled BOOLEAN DEFAULT TRUE,
  sms_enabled BOOLEAN DEFAULT TRUE,
  whatsapp_enabled BOOLEAN DEFAULT TRUE,
  email_address TEXT,
  phone_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id),
  UNIQUE(customer_phone)
);

-- Notification history
CREATE TABLE IF NOT EXISTS notification_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('whatsapp', 'email', 'sms')),
  recipient TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'delivered')),
  message TEXT,
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bookings_rescheduled_from ON bookings(rescheduled_from_booking_id) WHERE rescheduled_from_booking_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_rescheduled_at ON bookings(rescheduled_at) WHERE rescheduled_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_no_show ON bookings(no_show, business_id) WHERE no_show = TRUE;
CREATE INDEX IF NOT EXISTS idx_bookings_no_show_marked_at ON bookings(no_show_marked_at) WHERE no_show_marked_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user ON notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_phone ON notification_preferences(customer_phone);
CREATE INDEX IF NOT EXISTS idx_notification_history_booking ON notification_history(booking_id);
CREATE INDEX IF NOT EXISTS idx_notification_history_type ON notification_history(notification_type);
CREATE INDEX IF NOT EXISTS idx_notification_history_status ON notification_history(status);
CREATE INDEX IF NOT EXISTS idx_notification_history_sent_at ON notification_history(sent_at);

-- Analytics views
CREATE OR REPLACE VIEW booking_analytics_daily AS
SELECT
  business_id,
  DATE(created_at) as date,
  COUNT(*) as total_bookings,
  COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed_bookings,
  COUNT(*) FILTER (WHERE status = 'rejected') as rejected_bookings,
  COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_bookings,
  COUNT(*) FILTER (WHERE no_show = TRUE) as no_show_count
FROM bookings
GROUP BY business_id, DATE(created_at);

CREATE OR REPLACE VIEW booking_analytics_hourly AS
SELECT
  b.business_id,
  DATE(s.date) as date,
  EXTRACT(HOUR FROM s.start_time) as hour,
  COUNT(*) as booking_count
FROM bookings b
JOIN slots s ON b.slot_id = s.id
WHERE b.status = 'confirmed'
GROUP BY b.business_id, DATE(s.date), EXTRACT(HOUR FROM s.start_time);

CREATE OR REPLACE VIEW customer_retention AS
SELECT
  business_id,
  customer_phone,
  COUNT(DISTINCT DATE(created_at)) as booking_days,
  COUNT(*) as total_bookings,
  MAX(created_at) as last_booking_at,
  MIN(created_at) as first_booking_at
FROM bookings
WHERE status IN ('confirmed', 'pending')
GROUP BY business_id, customer_phone;

-- Trigger for notification preferences updated_at
CREATE TRIGGER update_notification_preferences_updated_at BEFORE UPDATE ON notification_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
