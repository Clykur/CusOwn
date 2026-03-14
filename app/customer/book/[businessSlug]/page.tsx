import { redirect } from 'next/navigation';
import PublicBookingPage from '@/components/booking/public-booking-page';

type Props = { params: Promise<{ businessSlug: string }> };

export const dynamic = 'force-dynamic';

/** Customer booking by slug: with sidebar */
export default async function CustomerBookPage({ params }: Props) {
  const { businessSlug } = await params;
  if (!businessSlug || typeof businessSlug !== 'string') {
    redirect('/');
  }
  return <PublicBookingPage businessSlug={businessSlug} />;
}
