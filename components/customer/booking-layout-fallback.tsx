'use client';

import { useEffect, useState } from 'react';
import CustomerBookingShell from '@/components/customer/customer-booking-shell';
import type { CustomerInitialUser } from '@/components/customer/customer-session-context';

type BookingLayoutFallbackProps = { children: React.ReactNode };

/**
 * When server layout did not see a session (e.g. RSC had no cookies), check session
 * on the client and show customer shell if user is a customer. Avoids sidebar
 * disappearing due to server/client cookie timing.
 */
export default function BookingLayoutFallback({ children }: BookingLayoutFallbackProps) {
  const [initialUser, setInitialUser] = useState<CustomerInitialUser | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/session', { credentials: 'include' })
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        const data = json?.data ?? json;
        const user = data?.user ?? null;
        const profile = data?.profile ?? null;
        const userType = (profile as { user_type?: string } | null)?.user_type;
        const isCustomer = userType === 'customer' || userType === 'both';
        if (user?.id && isCustomer) {
          setInitialUser({
            id: user.id,
            email: user.email ?? undefined,
            full_name: (profile as { full_name?: string } | null)?.full_name ?? undefined,
          });
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!checked) {
    return (
      <div className="min-h-screen bg-white">
        <div className="mx-auto w-full max-w-[1200px] py-8 px-6 sm:px-8 lg:px-10">{children}</div>
      </div>
    );
  }

  if (initialUser) {
    return <CustomerBookingShell initialUser={initialUser}>{children}</CustomerBookingShell>;
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto w-full max-w-[1200px] py-8 px-6 sm:px-8 lg:px-10">{children}</div>
    </div>
  );
}
