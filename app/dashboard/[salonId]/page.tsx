'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { API_ROUTES } from '@/config/constants';
import { ROUTES } from '@/lib/utils/navigation';
import { RedirectSkeleton } from '@/components/ui/skeleton';

/**
 * Legacy route: /dashboard/[salonId] is deprecated.
 * One canonical path: /owner/[bookingLink].
 * Redirects to owner business dashboard.
 */
export default function DashboardPage() {
  const params = useParams();
  const router = useRouter();
  const salonId = params.salonId as string;
  useEffect(() => {
    if (!salonId) {
      router.replace(ROUTES.OWNER_DASHBOARD_BASE);
      return;
    }

    const redirect = async () => {
      try {
        const response = await fetch(`${API_ROUTES.SALONS}/${salonId}`);
        const result = await response.json();

        if (result.success && result.data?.booking_link) {
          router.replace(`/owner/${result.data.booking_link}`);
          return;
        }
      } catch {
        // ignore
      }
      router.replace(ROUTES.OWNER_DASHBOARD_BASE);
    };

    redirect();
  }, [salonId, router]);

  return <RedirectSkeleton />;
}
