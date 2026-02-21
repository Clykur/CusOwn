-- Allow slot transition booked -> available so reschedule and cancel can release the slot.
-- Matches app slot-state-machine: booked + release -> available.

CREATE OR REPLACE FUNCTION public.check_slot_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- available -> reserved | booked
  IF OLD.status = 'available' AND NEW.status NOT IN ('reserved', 'booked') THEN
    RAISE EXCEPTION 'Invalid slot transition: available -> %', NEW.status;
  END IF;

  -- reserved -> available | booked
  IF OLD.status = 'reserved' AND NEW.status NOT IN ('available', 'booked') THEN
    RAISE EXCEPTION 'Invalid slot transition: reserved -> %', NEW.status;
  END IF;

  -- booked -> available only (reschedule/cancel releases slot)
  IF OLD.status = 'booked' AND NEW.status <> 'available' THEN
    RAISE EXCEPTION 'Invalid slot transition: booked -> %', NEW.status;
  END IF;

  RETURN NEW;
END;
$$;
