ALTER TABLE public.slots ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.slots FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view available slots" ON public.slots;
DROP POLICY IF EXISTS "Owners can view slots for their businesses" ON public.slots;
DROP POLICY IF EXISTS "Owners can update slots for their businesses" ON public.slots;
DROP POLICY IF EXISTS "Admins can view all slots" ON public.slots;
DROP POLICY IF EXISTS "Admins can update all slots" ON public.slots;
DROP POLICY IF EXISTS "slots_select" ON public.slots;
DROP POLICY IF EXISTS "slots_update" ON public.slots;

CREATE POLICY "slots_select" ON public.slots
  FOR SELECT USING (
    (
      (SELECT auth.uid()) IS NOT NULL
      AND status IN ('available', 'reserved')
      AND EXISTS (
        SELECT 1 FROM public.businesses b
        WHERE b.id = slots.business_id
          AND b.deleted_at IS NULL
          AND (b.suspended IS NULL OR b.suspended = false)
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = slots.business_id
        AND b.owner_user_id = (SELECT auth.uid())
        AND b.deleted_at IS NULL
    )
    OR EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = (SELECT auth.uid()) AND up.user_type = 'admin'
    )
  );

CREATE POLICY "slots_update" ON public.slots
  FOR UPDATE USING (
    (
      status != 'booked'
      AND EXISTS (
        SELECT 1 FROM public.businesses b
        WHERE b.id = slots.business_id
          AND b.owner_user_id = (SELECT auth.uid())
          AND b.deleted_at IS NULL
          AND (b.suspended IS NULL OR b.suspended = false)
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = (SELECT auth.uid()) AND up.user_type = 'admin'
    )
  );
