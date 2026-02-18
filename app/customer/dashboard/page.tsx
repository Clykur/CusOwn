'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { supabaseAuth } from '@/lib/supabase/auth';
import { ROUTES } from '@/lib/utils/navigation';

import CustomerBookingCard from '@/components/customer/booking-card';
import BookingCardSkeleton from '@/components/customer/booking-card.skeleton';
import SummaryCardSkeleton from '@/components/customer/summary-card.skeleton';

export default function CustomerDashboardPage() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [slotsMap, setSlotsMap] = useState<Record<string, any[]>>({});
  const [secureBookingUrls, setSecureBookingUrls] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  /* ----------------------------------
     FETCH BOOKINGS (STABLE CALLBACK)
  ---------------------------------- */
  const refetchBookings = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabaseAuth.auth.getSession();

      if (!session?.access_token) return;

      setLoading(true);

      const response = await fetch('/api/customer/bookings', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) return;

      const result = await response.json();
      if (!result.success) return;

      const bookingsData = result.data || [];

      /* Secure URLs */
      const urlMap = new Map<string, string>();
      for (const booking of bookingsData) {
        try {
          const { getSecureBookingStatusUrlClient } = await import('@/lib/utils/navigation');
          urlMap.set(booking.booking_id, await getSecureBookingStatusUrlClient(booking.booking_id));
        } catch {
          urlMap.set(booking.booking_id, ROUTES.BOOKING_STATUS(booking.booking_id));
        }
      }
      setSecureBookingUrls(urlMap);

      /* Slots per booking */
      const slotsResults = await Promise.all(
        bookingsData
          .filter((b: any) => b.slot && b.business_id)
          .map(async (b: any) => {
            try {
              const res = await fetch(`/api/slots?salon_id=${b.business_id}&date=${b.slot.date}`, {
                headers: {
                  Authorization: `Bearer ${session.access_token}`,
                },
              });
              const r = await res.json();
              if (r.success) return { id: b.id, slots: r.data || [] };
            } catch {}
            return null;
          })
      );

      const newSlotsMap: Record<string, any[]> = {};
      slotsResults.forEach((r) => {
        if (r) newSlotsMap[r.id] = r.slots;
      });

      setSlotsMap(newSlotsMap);
      setBookings(bookingsData);
    } catch (err) {
      console.error('[CUSTOMER_DASHBOARD] Refetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  /* ----------------------------------
     AUTH CHECK
  ---------------------------------- */
  useEffect(() => {
    const checkAuth = async () => {
      if (!supabaseAuth) {
        router.push(ROUTES.AUTH_LOGIN(ROUTES.CUSTOMER_DASHBOARD));
        return;
      }

      const {
        data: { session },
      } = await supabaseAuth.auth.getSession();

      if (!session?.user) {
        router.push(ROUTES.AUTH_LOGIN(ROUTES.CUSTOMER_DASHBOARD));
        return;
      }

      setUser(session.user);
      await refetchBookings();
    };

    checkAuth();
  }, [router, refetchBookings]);

  /* ----------------------------------
     AUTO REFRESH ON FOCUS / VISIBILITY
  ---------------------------------- */
  useEffect(() => {
    const handleFocus = () => refetchBookings();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refetchBookings();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [refetchBookings]);

  /* ----------------------------------
     UI
  ---------------------------------- */
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-20 lg:py-8">
      {loading ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <SummaryCardSkeleton />
            <SummaryCardSkeleton />
            <SummaryCardSkeleton />
          </div>
          <div className="grid gap-4">
            <BookingCardSkeleton />
            <BookingCardSkeleton />
          </div>
        </>
      ) : (
        <>
          {/* Empty State */}
          {bookings.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 px-6 pb-8 text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10"
                  />
                </svg>
              </div>

              <h2 className="text-lg font-semibold text-gray-900">No bookings yet</h2>
              <p className="text-sm text-gray-500">Book an appointment to see it appear here.</p>

              <Link
                href={ROUTES.CATEGORIES}
                className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white text-sm rounded-lg hover:bg-gray-900 transition"
              >
                Book your first appointment
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 sm:gap-6">
              {bookings.map((booking) => (
                <CustomerBookingCard
                  key={booking.id}
                  booking={booking}
                  availableSlots={slotsMap[booking.id] || []}
                  secureUrl={
                    secureBookingUrls.get(booking.booking_id) ||
                    ROUTES.BOOKING_STATUS(booking.booking_id)
                  }
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
