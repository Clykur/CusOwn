import { redirect } from 'next/navigation';
import PublicBookingPage from '@/components/booking/public-booking-page';
import { getServerUser } from '@/lib/supabase/server-auth';
import { ROUTES } from '@/lib/utils/navigation';

type Props = { params: Promise<{ businessSlug: string }> };

export const dynamic = 'force-dynamic';

/** Public booking by slug: requires auth. QR points here. */
export default async function BookPage({ params }: Props) {
  const { businessSlug } = await params;
  if (!businessSlug || typeof businessSlug !== 'string') {
    redirect('/');
  }

  // If not authenticated, redirect to login with redirect back to this page
  const user = await getServerUser();
  if (!user) {
    const bookingPath = `/book/${businessSlug}`;
    redirect(ROUTES.AUTH_LOGIN(bookingPath) + '&role=customer');
  }

  return <PublicBookingPage businessSlug={businessSlug} />;
}
