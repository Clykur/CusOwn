'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';

import { ROUTES } from '@/lib/utils/navigation';
import { UI_CUSTOMER } from '@/config/constants';
import { useCustomerSession } from '@/components/customer/customer-session-context';
import CustomerBookingCard from '@/components/customer/booking-card';
import BookingCardSkeleton from '@/components/customer/booking-card.skeleton';
import BookingsIcon from '@/src/icons/bookings.svg';
import SummaryCardSkeleton from '@/components/customer/summary-card.skeleton';

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="text-3xl font-bold text-slate-900 mt-1">{value}</div>
    </div>
  );
}

export default function CustomerDashboardPage() {
  const { initialUser } = useCustomerSession();
  const [bookings, setBookings] = useState<any[]>([]);
  const [slotsMap, setSlotsMap] = useState<Record<string, any[]>>({});
  const [secureBookingUrls, setSecureBookingUrls] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const lastRefetchRef = useRef(0);
  const MIN_REFETCH_INTERVAL = 3000; // 3s debounce

  /* ----------------------------------
     FETCH BOOKINGS (STABLE CALLBACK)
  ---------------------------------- */
  const refetchBookings = useCallback(async () => {
    try {
      setLoading(true);

      const response = await fetch('/api/customer/bookings', {
        credentials: 'include',
      });

      if (!response.ok) return;

      const result = await response.json();
      if (!result.success) return;

      const bookingsData = result.data || [];

      // Show bookings immediately — don't block on slots or URLs
      setBookings(bookingsData);
      setLoading(false);

      // Fetch secure URLs and slots in parallel in the background
      const [urlMap] = await Promise.all([
        // 1) Secure URLs — all in parallel
        (async () => {
          const map = new Map<string, string>();
          await Promise.all(
            bookingsData.map(async (booking: any) => {
              try {
                const { getSecureBookingStatusUrlClient } = await import('@/lib/utils/navigation');
                map.set(
                  booking.booking_id,
                  await getSecureBookingStatusUrlClient(booking.booking_id)
                );
              } catch {
                map.set(booking.booking_id, ROUTES.BOOKING_STATUS(booking.booking_id));
              }
            })
          );
          return map;
        })(),

        // 2) Slots — all in parallel
        (async () => {
          const slotsResults = await Promise.all(
            bookingsData
              .filter((b: any) => b.slot && b.business_id)
              .map(async (b: any) => {
                try {
                  const res = await fetch(
                    `/api/slots?salon_id=${b.business_id}&date=${b.slot.date}`,
                    {
                      credentials: 'include',
                    }
                  );
                  const r = await res.json();
                  if (r.success) {
                    const slotsArr = Array.isArray(r.data) ? r.data : (r.data?.slots ?? []);
                    return { id: b.id, slots: slotsArr };
                  }
                } catch {}
                return null;
              })
          );
          const newSlotsMap: Record<string, any[]> = {};
          slotsResults.forEach((r) => {
            if (r) newSlotsMap[r.id] = r.slots;
          });
          setSlotsMap(newSlotsMap);
        })(),
      ]);

      setSecureBookingUrls(urlMap);
    } catch (err) {
      console.error('[CUSTOMER_DASHBOARD] Refetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialUser?.id) {
      setLoading(false);
      return;
    }
    refetchBookings();
  }, [initialUser?.id, refetchBookings]);

  /* ----------------------------------
     AUTO REFRESH ON FOCUS / VISIBILITY
  ---------------------------------- */
  useEffect(() => {
    const debouncedRefetch = () => {
      const now = Date.now();
      if (now - lastRefetchRef.current < MIN_REFETCH_INTERVAL) return;
      lastRefetchRef.current = now;
      refetchBookings();
    };

    const handleFocus = () => debouncedRefetch();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        debouncedRefetch();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [refetchBookings]);

  const upcomingCount = bookings.filter(
    (b: any) => b.status === 'confirmed' || b.status === 'pending'
  ).length;
  const completedCount = bookings.filter(
    (b: any) => b.status === 'cancelled' || b.status === 'rejected' || b.status === 'expired'
  ).length;

  return (
    <div className="w-full pb-24 flex flex-col gap-8">
      {loading ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <SummaryCardSkeleton />
            <SummaryCardSkeleton />
            <SummaryCardSkeleton />
          </div>
          <div>
            <div className="h-7 w-40 bg-slate-200 rounded mb-4" aria-hidden />
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="space-y-4">
                <BookingCardSkeleton />
                <BookingCardSkeleton />
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <StatCard label={UI_CUSTOMER.STAT_TOTAL_APPOINTMENTS} value={bookings.length} />
            <StatCard label={UI_CUSTOMER.STAT_UPCOMING} value={upcomingCount} />
            <StatCard label={UI_CUSTOMER.STAT_COMPLETED} value={completedCount} />
          </div>

          <div>
            <h2 className="text-xl font-semibold text-slate-900 mb-4">
              {UI_CUSTOMER.SECTION_APPOINTMENTS}
            </h2>
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              {bookings.length === 0 ? (
                <div className="text-center py-12">
                  <div className="mx-auto w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                    <BookingsIcon className="w-8 h-8 text-slate-400" aria-hidden="true" />
                  </div>
                  <p className="text-slate-500 mb-4">{UI_CUSTOMER.EMPTY_ACTIVITY}</p>
                  <Link
                    href={ROUTES.CUSTOMER_CATEGORIES}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 transition shadow-sm"
                  >
                    {UI_CUSTOMER.CTA_EXPLORE_SERVICES}
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {bookings.map((booking) => (
                    <CustomerBookingCard key={booking.id} booking={booking} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
