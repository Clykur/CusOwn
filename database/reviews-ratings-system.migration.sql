-- Migration: Production-grade Reviews & Ratings.
-- One review per booking (confirmed only). Business rating_avg and review_count updated atomically.
-- Admin hide/unhide; soft-deleted users anonymized in application layer.

-- =============================================================================
-- 1. Business aggregate columns (rating_avg, review_count)
-- =============================================================================
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS rating_avg NUMERIC(3,2) DEFAULT NULL CHECK (rating_avg IS NULL OR (rating_avg >= 0 AND rating_avg <= 5));

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS review_count INTEGER NOT NULL DEFAULT 0 CHECK (review_count >= 0);

COMMENT ON COLUMN public.businesses.rating_avg IS 'Cached average of visible reviews; updated atomically with review_count.';
COMMENT ON COLUMN public.businesses.review_count IS 'Count of visible (non-hidden) reviews; updated atomically with rating_avg.';

-- =============================================================================
-- 2. Reviews table
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_reviews_booking_id UNIQUE (booking_id),
  CONSTRAINT fk_reviews_booking FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reviews_business_id ON public.reviews(business_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON public.reviews(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reviews_business_created ON public.reviews(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_is_hidden ON public.reviews(is_hidden) WHERE is_hidden = false;

COMMENT ON TABLE public.reviews IS 'One review per booking (confirmed). rating_avg/review_count on businesses updated atomically.';

-- =============================================================================
-- 3. RPC: create_review_atomically
-- Enforces: booking status = confirmed, one review per booking, updates aggregates in same tx.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.create_review_atomically(
  p_booking_id UUID,
  p_user_id UUID,
  p_rating INTEGER,
  p_comment TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_business_id UUID;
  v_booking_status TEXT;
  v_customer_user_id UUID;
  v_existing_id UUID;
  v_new_rating_avg NUMERIC(3,2);
  v_new_review_count BIGINT;
BEGIN
  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Rating must be between 1 and 5');
  END IF;

  SELECT b.business_id, b.status, b.customer_user_id
  INTO v_business_id, v_booking_status, v_customer_user_id
  FROM public.bookings b
  WHERE b.id = p_booking_id
  FOR UPDATE;

  IF v_business_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking not found');
  END IF;

  IF v_booking_status != 'confirmed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking must be confirmed to submit a review');
  END IF;

  SELECT id INTO v_existing_id FROM public.reviews WHERE booking_id = p_booking_id FOR UPDATE;
  IF FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Review already exists for this booking');
  END IF;

  INSERT INTO public.reviews (booking_id, business_id, user_id, rating, comment, is_hidden)
  VALUES (p_booking_id, v_business_id, p_user_id, p_rating, NULLIF(trim(COALESCE(p_comment, '')), ''), false);

  SELECT
    ROUND(AVG(rating)::NUMERIC, 2),
    COUNT(*)::BIGINT
  INTO v_new_rating_avg, v_new_review_count
  FROM public.reviews
  WHERE business_id = v_business_id AND is_hidden = false;

  UPDATE public.businesses
  SET rating_avg = v_new_rating_avg,
      review_count = COALESCE(v_new_review_count, 0)::INTEGER,
      updated_at = NOW()
  WHERE id = v_business_id;

  RETURN jsonb_build_object('success', true, 'review_id', (SELECT id FROM public.reviews WHERE booking_id = p_booking_id));
END;
$$;

COMMENT ON FUNCTION public.create_review_atomically IS 'Insert review for confirmed booking; one per booking; updates business rating_avg and review_count in same transaction.';

-- =============================================================================
-- 4. RPC: set_review_hidden_atomically (admin)
-- Toggle is_hidden and recalc business aggregates.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.set_review_hidden_atomically(
  p_review_id UUID,
  p_is_hidden BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_business_id UUID;
  v_new_rating_avg NUMERIC(3,2);
  v_new_review_count BIGINT;
BEGIN
  UPDATE public.reviews
  SET is_hidden = p_is_hidden
  WHERE id = p_review_id
  RETURNING business_id INTO v_business_id;

  IF v_business_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Review not found');
  END IF;

  SELECT
    ROUND(AVG(rating)::NUMERIC, 2),
    COUNT(*)::BIGINT
  INTO v_new_rating_avg, v_new_review_count
  FROM public.reviews
  WHERE business_id = v_business_id AND is_hidden = false;

  UPDATE public.businesses
  SET rating_avg = v_new_rating_avg,
      review_count = COALESCE(v_new_review_count, 0)::INTEGER,
      updated_at = NOW()
  WHERE id = v_business_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

COMMENT ON FUNCTION public.set_review_hidden_atomically IS 'Admin: set review is_hidden and recalc business rating_avg/review_count atomically.';
