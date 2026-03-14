'use client';

import { useEffect, useCallback, useRef, memo } from 'react';
import Link from 'next/link';

import { ROUTES } from '@/lib/utils/navigation';
import { UI_CUSTOMER } from '@/config/constants';
import { useCustomerSession } from '@/components/customer/customer-session-context';
import CustomerBookingsTable from '@/components/customer/CustomerBookingsTable';
import BookingsIcon from '@/src/icons/bookings.svg';
import SummaryCardSkeleton from '@/components/customer/summary-card.skeleton';
import { dedupFetch, cancelRequests } from '@/lib/utils/fetch-dedup';
import { useVisibilityRefresh } from '@/lib/hooks/use-visibility-refresh';
import { useCustomerBookingsStore, useBookingsStats } from '@/lib/store';

const CACHE_TTL = 30000;

const StatCard = memo(function StatCard({
  label,
  value,
  isRefreshing,
}: {
  label: string;
  value: number;
  isRefreshing?: boolean;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm transition-all duration-200">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="flex items-center gap-2">
        <div className="text-3xl font-bold text-slate-900 mt-1 tabular-nums">{value}</div>
        {isRefreshing && (
          <div className="w-4 h-4 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
        )}
      </div>
    </div>
  );
});

function StatsSection() {
  const stats = useBookingsStats();
  const isRefreshing = useCustomerBookingsStore((state) => state.isRefreshing);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
      <StatCard
        label={UI_CUSTOMER.STAT_TOTAL_APPOINTMENTS}
        value={stats.total}
        isRefreshing={isRefreshing}
      />
      <StatCard label={UI_CUSTOMER.STAT_UPCOMING} value={stats.upcoming} />
      <StatCard label={UI_CUSTOMER.STAT_COMPLETED} value={stats.completed} />
    </div>
  );
}

export default function CustomerDashboardPage() {
  const { initialUser } = useCustomerSession();

  const bookings = useCustomerBookingsStore((state) => state.bookings);
  const isInitialLoad = useCustomerBookingsStore((state) => state.isInitialLoad);
  const isRefreshing = useCustomerBookingsStore((state) => state.isRefreshing);
  const lastFetchedAt = useCustomerBookingsStore((state) => state.lastFetchedAt);
  const setBookings = useCustomerBookingsStore((state) => state.setBookings);
  const setIsInitialLoad = useCustomerBookingsStore((state) => state.setIsInitialLoad);
  const setIsRefreshing = useCustomerBookingsStore((state) => state.setIsRefreshing);
  const setLastFetchedAt = useCustomerBookingsStore((state) => state.setLastFetchedAt);

  const lastRefetchRef = useRef(0);
  const MIN_REFETCH_INTERVAL = 3000;
  const hasMountedRef = useRef(false);
  const bookingsLengthRef = useRef(bookings.length);

  useEffect(() => {
    hasMountedRef.current = true;
  }, []);

  useEffect(() => {
    bookingsLengthRef.current = bookings.length;
  }, [bookings.length]);

  const refetchBookings = useCallback(
    async (showRefreshIndicator = true) => {
      try {
        if (showRefreshIndicator && bookingsLengthRef.current > 0) {
          setIsRefreshing(true);
        } else if (bookingsLengthRef.current === 0 && hasMountedRef.current) {
          setIsInitialLoad(true);
        }

        cancelRequests('customer-dashboard');

        const response = await dedupFetch('/api/customer/bookings', {
          credentials: 'include',
          dedupKey: 'customer-dashboard:bookings',
          cancelPrevious: true,
        });

        if (!response.ok) return;

        const result = await response.json();
        if (!result.success) return;

        const bookingsData = result.data || [];
        setBookings(bookingsData);
        setLastFetchedAt(Date.now());
      } catch (err) {
        if ((err as Error)?.name !== 'AbortError') {
          console.error('[CUSTOMER_DASHBOARD] Refetch failed:', err);
        }
      } finally {
        setIsInitialLoad(false);
        setIsRefreshing(false);
      }
    },
    [setBookings, setIsInitialLoad, setIsRefreshing, setLastFetchedAt]
  );

  useEffect(() => {
    if (!hasMountedRef.current) return;
    if (!initialUser?.id) {
      setIsInitialLoad(false);
      return;
    }

    const hasFreshCache = lastFetchedAt && Date.now() - lastFetchedAt < CACHE_TTL;
    refetchBookings(!hasFreshCache);
  }, [initialUser?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleVisibilityRefresh = useCallback(() => {
    const now = Date.now();
    if (now - lastRefetchRef.current < MIN_REFETCH_INTERVAL) return;
    lastRefetchRef.current = now;
    refetchBookings(true);
  }, [refetchBookings]);

  useVisibilityRefresh({
    onRefresh: handleVisibilityRefresh,
    enabled: !!initialUser?.id,
    throttleMs: MIN_REFETCH_INTERVAL,
    staleThresholdMs: CACHE_TTL,
    refreshOnFocus: true,
  });

  if (isInitialLoad && bookings.length === 0) {
    return (
      <div className="w-full pb-24 flex flex-col gap-8 animate-in fade-in duration-200">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <SummaryCardSkeleton />
          <SummaryCardSkeleton />
          <SummaryCardSkeleton />
        </div>
        <div>
          <div className="h-7 w-40 bg-slate-200 rounded mb-4 animate-pulse" aria-hidden />
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <div className="animate-pulse space-y-3">
              <div className="h-10 bg-slate-100 rounded w-full" aria-hidden />
              <div className="h-10 bg-slate-100 rounded w-full" aria-hidden />
              <div className="h-10 bg-slate-100 rounded w-full" aria-hidden />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full pb-24 flex flex-col gap-8 animate-in fade-in duration-150">
      <StatsSection />

      <div>
        <h2 className="text-xl font-semibold text-slate-900 mb-4">
          {UI_CUSTOMER.SECTION_APPOINTMENTS}
        </h2>
        {bookings.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="text-center py-12">
              <div className="mx-auto w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <BookingsIcon className="w-8 h-8 text-slate-400" aria-hidden="true" />
              </div>
              <p className="text-slate-500 mb-4">{UI_CUSTOMER.EMPTY_ACTIVITY}</p>
              <Link
                href={ROUTES.CUSTOMER_CATEGORIES}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 active:scale-[0.98] transition-all shadow-sm"
              >
                {UI_CUSTOMER.CTA_EXPLORE_SERVICES}
              </Link>
            </div>
          </div>
        ) : (
          <CustomerBookingsTable bookings={bookings} />
        )}
      </div>
    </div>
  );
}
