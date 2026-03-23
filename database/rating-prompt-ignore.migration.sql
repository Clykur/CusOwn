-- Migration: Rating Prompt Ignore Tracking
-- Tracks bookings where user chose to ignore the rating prompt
-- One record per booking (if ignored)

-- =============================================================================
-- 1. Rating prompt ignore table
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.rating_prompt_ignores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,
  customer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ignored_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rating_prompt_ignores_booking_id 
  ON public.rating_prompt_ignores(booking_id);

CREATE INDEX IF NOT EXISTS idx_rating_prompt_ignores_customer_user_id 
  ON public.rating_prompt_ignores(customer_user_id, ignored_at DESC);

COMMENT ON TABLE public.rating_prompt_ignores IS 'Tracks bookings where user ignored the rating prompt; one record per ignored booking.';

-- =============================================================================
-- 2. RPC: Get booking pending rating (most recent confirmed past booking without rating/ignore)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_pending_rating_booking(
  p_customer_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_booking_id UUID;
  v_booking_uuid UUID;
  v_salon_name TEXT;
  v_salon_id UUID;
  v_slot_date DATE;
  v_slot_start_time TIME;
  v_candidate_count INTEGER;
BEGIN
  -- Debug: count eligible candidates first
  SELECT COUNT(*)
  INTO v_candidate_count
  FROM public.bookings b
  JOIN public.slots s ON b.slot_id = s.id
  WHERE b.customer_user_id = p_customer_user_id
    AND b.status = 'confirmed'::text
    AND (s.date + s.end_time) <= NOW()
    AND NOT EXISTS (SELECT 1 FROM public.reviews r WHERE r.booking_id = b.id)
    AND NOT EXISTS (SELECT 1 FROM public.rating_prompt_ignores rpi WHERE rpi.booking_id = b.id);

  RAISE NOTICE '[RATING] Pending candidates for user %: %', p_customer_user_id, v_candidate_count;

  -- Find most recent eligible booking
  SELECT b.id, b.booking_id, b.business_id, s.date, s.start_time, sal.salon_name
  INTO v_booking_id, v_booking_uuid, v_salon_id, v_slot_date, v_slot_start_time, v_salon_name
  FROM public.bookings b
  JOIN public.slots s ON b.slot_id = s.id
  JOIN public.businesses sal ON b.business_id = sal.id
  WHERE b.customer_user_id = p_customer_user_id
    AND b.status = 'confirmed'::text
    AND (s.date + s.end_time) <= NOW()
    AND NOT EXISTS (SELECT 1 FROM public.reviews r WHERE r.booking_id = b.id)
    AND NOT EXISTS (SELECT 1 FROM public.rating_prompt_ignores rpi WHERE rpi.booking_id = b.id)
  ORDER BY (s.date + s.end_time) DESC NULLS LAST
  LIMIT 1;

  RAISE NOTICE '[RATING] Selected booking for user %: % (found: %)', p_customer_user_id, COALESCE(v_booking_id::text, 'none'), (v_booking_id IS NOT NULL);

  IF v_booking_id IS NULL THEN
    RETURN jsonb_build_object('success', true, 'booking', NULL);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'booking', jsonb_build_object(
      'id', v_booking_id,
      'booking_id', v_booking_uuid,
      'salon_id', v_salon_id,
      'salon_name', v_salon_name,
      'service_date', v_slot_date,
      'service_time', v_slot_start_time
    )
  );
END $$;

-- =============================================================================
-- 3. RPC: Create rating prompt ignore record
-- =============================================================================
CREATE OR REPLACE FUNCTION public.create_rating_prompt_ignore(
  p_booking_id UUID,
  p_customer_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_exists_review BOOLEAN;
  v_exists_ignore BOOLEAN;
BEGIN
  -- Check if review already exists
  SELECT EXISTS(SELECT 1 FROM public.reviews WHERE booking_id = p_booking_id)
  INTO v_exists_review;

  IF v_exists_review THEN
    RETURN jsonb_build_object('success', false, 'error', 'Review already exists for this booking');
  END IF;

  -- Check if already ignored
  SELECT EXISTS(SELECT 1 FROM public.rating_prompt_ignores WHERE booking_id = p_booking_id)
  INTO v_exists_ignore;

  IF v_exists_ignore THEN
    RETURN jsonb_build_object('success', false, 'error', 'Rating prompt already ignored for this booking');
  END IF;

  -- Insert ignore record
  INSERT INTO public.rating_prompt_ignores (booking_id, customer_user_id)
  VALUES (p_booking_id, p_customer_user_id);

  RETURN jsonb_build_object('success', true);
END $$;

