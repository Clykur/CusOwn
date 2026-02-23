-- Migration: One undo per booking. Once owner undoes accept/reject, undo cannot be used again for that booking.
-- Safe to run once.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS undo_used_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

COMMENT ON COLUMN public.bookings.undo_used_at IS 'Set when owner undoes accept or reject; prevents further undo for this booking.';
