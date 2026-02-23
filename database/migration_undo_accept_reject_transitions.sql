-- Migration: Add undo_confirm and undo_reject transitions for owner booking undo.
-- Safe to run once. Idempotent.

-- confirmed -> undo_confirm -> pending
INSERT INTO public.booking_state_transitions (from_state_id, event, to_state_id)
SELECT f.id, 'undo_confirm', t.id
FROM public.booking_states f, public.booking_states t
WHERE f.name = 'confirmed' AND t.name = 'pending'
ON CONFLICT (from_state_id, event) DO NOTHING;

-- rejected -> undo_reject -> pending
INSERT INTO public.booking_state_transitions (from_state_id, event, to_state_id)
SELECT f.id, 'undo_reject', t.id
FROM public.booking_states f, public.booking_states t
WHERE f.name = 'rejected' AND t.name = 'pending'
ON CONFLICT (from_state_id, event) DO NOTHING;
