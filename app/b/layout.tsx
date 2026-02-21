import { getServerUser, getServerUserProfile } from '@/lib/supabase/server-auth';
import CustomerBookingShell from '@/components/customer/customer-booking-shell';
import BookingLayoutFallback from '@/components/customer/booking-layout-fallback';
import type { CustomerInitialUser } from '@/components/customer/customer-session-context';

export const dynamic = 'force-dynamic';

export default async function BLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerUser();
  if (!user) {
    return <BookingLayoutFallback>{children}</BookingLayoutFallback>;
  }

  const profile = await getServerUserProfile(user.id);
  const isCustomer = profile?.user_type === 'customer' || profile?.user_type === 'both';
  if (!isCustomer) {
    return <BookingLayoutFallback>{children}</BookingLayoutFallback>;
  }

  const initialUser: CustomerInitialUser = {
    id: user.id,
    email: user.email ?? undefined,
    full_name: profile.full_name ?? undefined,
  };

  return <CustomerBookingShell initialUser={initialUser}>{children}</CustomerBookingShell>;
}
