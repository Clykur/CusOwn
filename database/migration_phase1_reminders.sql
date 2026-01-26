-- Migration: Phase 1 - Reminder System
-- Creates table for booking reminders

CREATE TABLE IF NOT EXISTS booking_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('24h_before', '2h_before', 'custom')),
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'sms', 'email')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_reminders_booking_id ON booking_reminders(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_reminders_scheduled_at ON booking_reminders(scheduled_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_booking_reminders_status ON booking_reminders(status);

CREATE TRIGGER update_booking_reminders_updated_at BEFORE UPDATE ON booking_reminders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
