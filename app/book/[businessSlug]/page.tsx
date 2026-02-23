import { redirect } from 'next/navigation';
import PublicBookingPage from '@/components/booking/public-booking-page';

type Props = { params: Promise<{ businessSlug: string }> };

export const dynamic = 'force-dynamic';

/** Public booking by slug: no auth. QR points here. */
export default async function BookPage({ params }: Props) {
  const { businessSlug } = await params;
  if (!businessSlug || typeof businessSlug !== 'string') {
    redirect('/');
  }
  return <PublicBookingPage businessSlug={businessSlug} />;
}
