-- Migration: Allow undo accept/reject in booking status transition trigger.
-- Enables rejected -> pending (undo reject) and confirmed -> pending (undo accept).
-- Safe to run once. Replaces check_booking_status_transition.

CREATE OR REPLACE FUNCTION public.check_booking_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- pending -> confirmed | rejected | cancelled
  IF OLD.status = 'pending' AND NEW.status NOT IN ('confirmed', 'rejected', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid booking transition: pending -> %', NEW.status;
  END IF;

  -- confirmed -> cancelled | pending (pending = undo accept)
  IF OLD.status = 'confirmed' AND NEW.status NOT IN ('cancelled', 'pending') THEN
    RAISE EXCEPTION 'Invalid booking transition: confirmed -> %', NEW.status;
  END IF;

  -- rejected -> pending only (undo reject); no other transitions from rejected
  IF OLD.status = 'rejected' AND NEW.status <> 'pending' THEN
    RAISE EXCEPTION 'Invalid booking transition: rejected -> %', NEW.status;
  END IF;

  -- cancelled is terminal
  IF OLD.status = 'cancelled' THEN
    RAISE EXCEPTION 'Invalid booking transition: % is terminal', OLD.status;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.check_booking_status_transition() IS 'Enforces valid booking status transitions; allows undo accept (confirmed->pending) and undo reject (rejected->pending).';
