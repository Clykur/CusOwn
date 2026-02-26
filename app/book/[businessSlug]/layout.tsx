/**
 * Public booking layout: wraps with customer sidebar/nav when logged in.
 */
export const dynamic = 'force-dynamic';

import BookingLayoutFallback from '@/components/customer/booking-layout-fallback';

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return <BookingLayoutFallback>{children}</BookingLayoutFallback>;
}
