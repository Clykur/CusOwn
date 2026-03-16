'use client';

import { useEffect, useCallback, useRef, useMemo, useState, memo } from 'react';
import dynamic from 'next/dynamic';
import OwnerPageLoader from '@/components/owner/owner-page-loader';
import { OwnerDashboardSkeleton } from '@/components/ui/skeleton';
import BookingCard from '@/components/owner/booking-card';
import PullToRefresh from '@/components/ui/pull-to-refresh';
import { useOwnerSession } from '@/components/owner/owner-session-context';
import { BookingWithDetails } from '@/types';
import { IconCheck, IconCross } from '@/components/ui/status-icons';
import { UNDO_ACCEPT_REJECT_WINDOW_MINUTES, UI_CONTEXT } from '@/config/constants';
import { Toast } from '@/components/ui/toast';
import UndoIcon from '@/src/icons/undo.svg';
import ExploreIcon from '@/src/icons/explore.svg';
import { useBookingSyncChannel } from '@/lib/hooks/use-booking-sync-channel';
import { dedupFetch, cancelRequests } from '@/lib/utils/fetch-dedup';
import { useOwnerDashboardStore, selectFilteredBookings, useUIStore } from '@/lib/store';

const DateFilter = dynamic(() => import('@/components/owner/date-filter'), {
  ssr: false,
  loading: () => <div className="h-9 w-32 bg-slate-100 rounded-lg animate-pulse" />,
});

const NoShowButton = dynamic(() => import('@/components/booking/no-show-button'), {
  ssr: false,
  loading: () => (
    <button disabled className="px-3 py-1.5 text-xs bg-slate-100 text-slate-400 rounded-lg">
      Loading...
    </button>
  ),
});

const SEARCH_DEBOUNCE_MS = 300;

const Stat = memo(function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-6 overflow-visible">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="text-3xl font-bold text-slate-900">{value}</div>
    </div>
  );
});

const StatsGrid = memo(function StatsGrid() {
  const stats = useOwnerDashboardStore((state) => state.stats);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 gap-6">
      <Stat label="Total Businesses" value={stats?.totalBusinesses ?? 0} />
      <Stat label="Total Bookings" value={stats?.totalBookings ?? 0} />
      <Stat label="Confirmed" value={stats?.confirmedBookings ?? 0} />
      <Stat label="Pending" value={stats?.pendingBookings ?? 0} />
    </div>
  );
});

function SearchInput() {
  const setSearchTerm = useOwnerDashboardStore((state) => state.setSearchTerm);
  const [localValue, setLocalValue] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setLocalValue(value);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        setSearchTerm(value);
      }, SEARCH_DEBOUNCE_MS);
    },
    [setSearchTerm]
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <input
      type="text"
      placeholder="Search by name, booking ID, phone..."
      value={localValue}
      onChange={handleChange}
      className="w-full h-9 px-4 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
      autoFocus
    />
  );
}

const DateFilters = memo(function DateFilters() {
  const fromDate = useOwnerDashboardStore((state) => state.fromDate);
  const toDate = useOwnerDashboardStore((state) => state.toDate);
  const setFromDate = useOwnerDashboardStore((state) => state.setFromDate);
  const setToDate = useOwnerDashboardStore((state) => state.setToDate);

  return (
    <>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-500">From</span>
        <div className="w-40 lg:w-44">
          <DateFilter value={fromDate} onChange={setFromDate} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-500">To</span>
        <div className="w-40 lg:w-44">
          <DateFilter value={toDate} onChange={setToDate} />
        </div>
      </div>
    </>
  );
});

const MobileDateFilters = memo(function MobileDateFilters() {
  const fromDate = useOwnerDashboardStore((state) => state.fromDate);
  const toDate = useOwnerDashboardStore((state) => state.toDate);
  const setFromDate = useOwnerDashboardStore((state) => state.setFromDate);
  const setToDate = useOwnerDashboardStore((state) => state.setToDate);

  return (
    <div className="flex gap-3">
      <div className="flex flex-col flex-1">
        <span className="text-xs font-semibold text-gray-500 mb-1">From</span>
        <DateFilter value={fromDate} onChange={setFromDate} />
      </div>
      <div className="flex flex-col flex-1">
        <span className="text-xs font-semibold text-gray-500 mb-1">To</span>
        <DateFilter value={toDate} onChange={setToDate} />
      </div>
    </div>
  );
});

export default function OwnerDashboardPage() {
  const { initialUser } = useOwnerSession();

  const isLoading = useOwnerDashboardStore((state) => state.isLoading);
  const setIsLoading = useOwnerDashboardStore((state) => state.setIsLoading);
  const setStats = useOwnerDashboardStore((state) => state.setStats);
  const setBookings = useOwnerDashboardStore((state) => state.setBookings);
  const updateBooking = useOwnerDashboardStore((state) => state.updateBooking);
  const fromDate = useOwnerDashboardStore((state) => state.fromDate);
  const toDate = useOwnerDashboardStore((state) => state.toDate);
  const processingBookingId = useOwnerDashboardStore((state) => state.processingBookingId);
  const setProcessingBookingId = useOwnerDashboardStore((state) => state.setProcessingBookingId);
  const filteredBookings = useOwnerDashboardStore(selectFilteredBookings);

  const showToast = useUIStore((state) => state.showToast);
  const toasts = useUIStore((state) => state.toasts);
  const dismissToast = useUIStore((state) => state.dismissToast);

  const [showSearch, setShowSearch] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { publishBookingUpdated, publishRefreshAll } = useBookingSyncChannel({
    onBookingUpdated: (event) => {
      updateBooking(event.bookingId, {
        status: event.status as BookingWithDetails['status'],
      });
    },
    onRefreshAll: () => {
      fetchBookings();
    },
  });

  const fetchDashboard = useCallback(async () => {
    if (!initialUser?.id) {
      setIsLoading(false);
      return;
    }

    try {
      const params = new URLSearchParams();
      if (fromDate) params.append('fromDate', fromDate);
      if (toDate) params.append('toDate', toDate);

      cancelRequests('owner-dashboard');

      const url = `/api/owner/dashboard${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await dedupFetch(url, {
        credentials: 'include',
        dedupKey: `owner-dashboard:${fromDate || 'all'}:${toDate || 'all'}`,
        cancelPrevious: true,
      });

      if (!response.ok) {
        setIsLoading(false);
        return;
      }

      const json = await response.json();
      if (json?.data) {
        const { stats: dashboardStats, recentBookings, bookingsByBusiness } = json.data;

        setStats({
          totalBusinesses: dashboardStats?.totalBusinesses ?? 0,
          totalBookings: dashboardStats?.totalBookings ?? 0,
          confirmedBookings: dashboardStats?.confirmedBookings ?? 0,
          pendingBookings: dashboardStats?.pendingBookings ?? 0,
          cancelledBookings: dashboardStats?.cancelledBookings ?? 0,
        });

        const allBookings: BookingWithDetails[] = [];
        if (bookingsByBusiness) {
          Object.values(bookingsByBusiness).forEach((businessBookings) => {
            if (Array.isArray(businessBookings)) {
              allBookings.push(...(businessBookings as BookingWithDetails[]));
            }
          });
        } else if (Array.isArray(recentBookings)) {
          allBookings.push(...recentBookings);
        }

        allBookings.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
        setBookings(allBookings);
      }
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        console.error('[OwnerDashboard] Failed to fetch dashboard:', err);
      }
    } finally {
      setIsLoading(false);
    }
  }, [initialUser?.id, fromDate, toDate, setIsLoading, setStats, setBookings]);

  const fetchBookings = useCallback(async () => {
    await fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!searchContainerRef.current) return;
      if (!searchContainerRef.current.contains(event.target as Node)) {
        setShowSearch(false);
      }
    };

    if (showSearch) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSearch, setShowSearch]);

  const handleAccept = async (bookingId: string) => {
    if (processingBookingId) return;
    if (!confirm('Are you sure you want to accept this booking?')) return;
    setProcessingBookingId(bookingId);

    const prevStatus = filteredBookings.find((b) => b.id === bookingId)?.status;
    updateBooking(bookingId, { status: 'confirmed', updated_at: new Date().toISOString() });

    try {
      const csrfToken = await (await import('@/lib/utils/csrf-client')).getCSRFToken();
      const headers: Record<string, string> = {};
      if (csrfToken) headers['x-csrf-token'] = csrfToken;

      const response = await fetch(`/api/bookings/${bookingId}/accept`, {
        method: 'POST',
        headers,
        credentials: 'include',
      });

      if (response.ok) {
        showToast('Booking accepted', 'success', 2000);
        publishBookingUpdated(bookingId, 'confirmed');
      } else {
        updateBooking(bookingId, { status: prevStatus });
        const result = await response.json();
        showToast(result.error || 'Failed to accept booking', 'error', 2000);
      }
    } catch {
      updateBooking(bookingId, { status: prevStatus });
      showToast('Failed to accept booking', 'error', 2000);
    } finally {
      setProcessingBookingId(null);
    }
  };

  const handleReject = async (bookingId: string) => {
    if (processingBookingId) return;
    if (!confirm('Are you sure you want to reject this booking?')) return;
    setProcessingBookingId(bookingId);

    const prevStatus = filteredBookings.find((b) => b.id === bookingId)?.status;
    updateBooking(bookingId, { status: 'rejected', updated_at: new Date().toISOString() });

    try {
      const csrfToken = await (await import('@/lib/utils/csrf-client')).getCSRFToken();
      const headers: Record<string, string> = {};
      if (csrfToken) headers['x-csrf-token'] = csrfToken;

      const response = await fetch(`/api/bookings/${bookingId}/reject`, {
        method: 'POST',
        headers,
        credentials: 'include',
      });

      if (response.ok) {
        showToast('Booking rejected', 'success', 2000);
        publishBookingUpdated(bookingId, 'rejected');
      } else {
        updateBooking(bookingId, { status: prevStatus });
        const result = await response.json();
        showToast(result.error || 'Failed to reject booking', 'error', 2000);
      }
    } catch {
      updateBooking(bookingId, { status: prevStatus });
      showToast('Failed to reject booking', 'error', 2000);
    } finally {
      setProcessingBookingId(null);
    }
  };

  const handleUndoAccept = useCallback(
    async (bookingId: string) => {
      if (processingBookingId) return;
      setProcessingBookingId(bookingId);

      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
        undoTimeoutRef.current = null;
      }

      const prevBooking = filteredBookings.find((b) => b.id === bookingId);
      updateBooking(bookingId, {
        status: 'pending',
        undo_used_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      try {
        const csrfToken = await (await import('@/lib/utils/csrf-client')).getCSRFToken();
        const headers: Record<string, string> = {};
        if (csrfToken) headers['x-csrf-token'] = csrfToken;

        const res = await fetch(`/api/bookings/${bookingId}/undo-accept`, {
          method: 'POST',
          headers,
          credentials: 'include',
        });
        const json = await res.json();

        if (res.ok) {
          showToast(UI_CONTEXT.REVERTED_TO_PENDING, 'success', 2000);
          publishBookingUpdated(bookingId, 'pending');
        } else {
          if (prevBooking) {
            updateBooking(bookingId, {
              status: prevBooking.status,
              undo_used_at: prevBooking.undo_used_at,
              updated_at: prevBooking.updated_at,
            });
          }
          showToast(json.error || 'Failed to undo', 'error', 2000);
        }
      } catch {
        showToast('Failed to undo', 'error', 2000);
      } finally {
        setProcessingBookingId(null);
      }
    },
    [
      processingBookingId,
      filteredBookings,
      updateBooking,
      setProcessingBookingId,
      showToast,
      publishBookingUpdated,
    ]
  );

  const handleUndoReject = useCallback(
    async (bookingId: string) => {
      if (processingBookingId) return;
      setProcessingBookingId(bookingId);

      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
        undoTimeoutRef.current = null;
      }

      const prevBooking = filteredBookings.find((b) => b.id === bookingId);
      updateBooking(bookingId, {
        status: 'pending',
        undo_used_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      try {
        const csrfToken = await (await import('@/lib/utils/csrf-client')).getCSRFToken();
        const headers: Record<string, string> = {};
        if (csrfToken) headers['x-csrf-token'] = csrfToken;

        const res = await fetch(`/api/bookings/${bookingId}/undo-reject`, {
          method: 'POST',
          headers,
          credentials: 'include',
        });
        const json = await res.json();

        if (res.ok) {
          showToast(UI_CONTEXT.REVERTED_TO_PENDING, 'success', 2000);
        } else {
          if (prevBooking) {
            updateBooking(bookingId, {
              status: prevBooking.status,
              undo_used_at: prevBooking.undo_used_at,
              updated_at: prevBooking.updated_at,
            });
          }
          showToast(json.error || 'Failed to undo', 'error', 2000);
        }
      } catch {
        showToast('Failed to undo', 'error', 2000);
      } finally {
        setProcessingBookingId(null);
      }
    },
    [processingBookingId, filteredBookings, updateBooking, setProcessingBookingId, showToast]
  );

  const handleBookingRescheduled = useCallback(() => {
    fetchBookings();
  }, [fetchBookings]);

  const handleNoShowMarked = useCallback(
    (bookingId: string) => {
      updateBooking(bookingId, { no_show: true });
    },
    [updateBooking]
  );

  const canUndo = useCallback((b: BookingWithDetails) => {
    if (b.status !== 'confirmed' && b.status !== 'rejected') return false;
    if (b.undo_used_at) return false;
    const windowMs = UNDO_ACCEPT_REJECT_WINDOW_MINUTES * 60 * 1000;
    return Date.now() - new Date(b.updated_at).getTime() < windowMs;
  }, []);

  if (isLoading) return <OwnerPageLoader title="Loading Dashboard" />;

  return (
    <div className="w-full pb-24 flex flex-col gap-6">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          variant={toast.variant}
          onDismiss={() => dismissToast(toast.id)}
          duration={toast.duration}
        />
      ))}

      <StatsGrid />

      <div>
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Your Customers</h2>
        <div className="bg-white border border-slate-200 rounded-lg p-6 overflow-visible">
          <div className="hidden md:flex items-center justify-between mb-4 relative">
            <h2 className="text-lg font-semibold">Bookings</h2>

            <div ref={searchContainerRef} className="flex items-center gap-3 relative">
              <button
                onClick={() => setShowSearch((prev) => !prev)}
                className="h-9 w-9 flex items-center justify-center rounded-lg border border-gray-300 bg-white hover:bg-gray-50 transition"
              >
                <ExploreIcon className="h-4 w-4 text-gray-600" />
              </button>

              <div className="flex flex-row gap-3">
                <DateFilters />
              </div>
            </div>
          </div>

          <div className="md:hidden mb-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Bookings</h2>
              <button
                onClick={() => setShowSearch((prev) => !prev)}
                className="h-9 w-9 flex items-center justify-center rounded-lg border border-gray-300 bg-white hover:bg-gray-50 transition"
              >
                <ExploreIcon className="h-4 w-4 text-gray-600" />
              </button>
            </div>
            <MobileDateFilters />
          </div>

          {showSearch && (
            <div ref={searchContainerRef} className="mb-4">
              <SearchInput />
            </div>
          )}

          <div className="lg:hidden">
            <PullToRefresh onRefresh={async () => fetchBookings()}>
              <div className="space-y-4">
                {filteredBookings.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500">No bookings for selected date range</p>
                  </div>
                ) : (
                  filteredBookings.map((booking) => (
                    <BookingCard
                      key={booking.id}
                      booking={booking}
                      onAccept={handleAccept}
                      onReject={handleReject}
                      processingId={processingBookingId}
                      onRescheduled={handleBookingRescheduled}
                      onNoShowMarked={handleNoShowMarked}
                      onUndoAccept={handleUndoAccept}
                      onUndoReject={handleUndoReject}
                      undoWindowMinutes={UNDO_ACCEPT_REJECT_WINDOW_MINUTES}
                    />
                  ))
                )}
              </div>
            </PullToRefresh>
          </div>

          <div className="hidden lg:block">
            {filteredBookings.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">No bookings for selected date range</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Customer
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date & Time
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Booking ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Business
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Rating
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status & actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredBookings.map((booking) => (
                      <BookingTableRow
                        key={booking.id}
                        booking={booking}
                        processingBookingId={processingBookingId}
                        onAccept={handleAccept}
                        onReject={handleReject}
                        onUndoAccept={handleUndoAccept}
                        onUndoReject={handleUndoReject}
                        onNoShowMarked={handleNoShowMarked}
                        canUndo={canUndo}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface BookingTableRowProps {
  booking: BookingWithDetails;
  processingBookingId: string | null;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onUndoAccept: (id: string) => void;
  onUndoReject: (id: string) => void;
  onNoShowMarked: (id: string) => void;
  canUndo: (b: BookingWithDetails) => boolean;
}

const BookingTableRow = memo(function BookingTableRow({
  booking,
  processingBookingId,
  onAccept,
  onReject,
  onUndoAccept,
  onUndoReject,
  onNoShowMarked,
  canUndo,
}: BookingTableRowProps) {
  const isSlotExpired = booking.slot
    ? new Date(`${booking.slot.date}T${booking.slot.end_time}`) <= new Date()
    : false;
  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm font-medium text-gray-900">{booking.customer_name}</div>
        <div className="text-sm text-gray-500">{booking.customer_phone}</div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        {booking.slot ? (
          <div>
            <div className="text-sm text-gray-900">
              {new Date(booking.slot.date).toLocaleDateString()}
            </div>
            <div className="text-sm text-gray-500">
              {booking.slot.start_time} - {booking.slot.end_time}
            </div>
          </div>
        ) : (
          <span className="text-sm text-gray-500">N/A</span>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className="text-sm text-gray-500 font-mono">{booking.booking_id}</span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-900">{booking.salon?.salon_name}</div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
        {booking.review ? `${booking.review.rating} ★` : '—'}
      </td>
      <td className="px-6 py-4 text-sm font-medium">
        <div className="flex flex-wrap gap-2 items-center">
          {(() => {
            if (booking.status === 'pending' && !isSlotExpired) {
              return (
                <>
                  <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-700">
                    Pending
                  </span>
                  <button
                    onClick={() => onAccept(booking.id)}
                    disabled={processingBookingId === booking.id}
                    className="h-9 w-9 flex items-center justify-center text-green-600 disabled:opacity-50 hover:text-green-700 transition"
                    title="Accept"
                    aria-label="Accept booking"
                  >
                    <IconCheck className="h-6 w-6" />
                  </button>
                  <button
                    onClick={() => onReject(booking.id)}
                    disabled={processingBookingId === booking.id}
                    className="h-9 w-9 flex items-center justify-center text-red-600 disabled:opacity-50 hover:text-red-700 transition"
                    title="Reject"
                    aria-label="Reject booking"
                  >
                    <IconCross className="h-6 w-6" />
                  </button>
                </>
              );
            } else if (booking.status === 'pending' && isSlotExpired) {
              return (
                <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-700">
                  Expired
                </span>
              );
            }
            return null;
          })()}
          {booking.status === 'confirmed' && (
            <>
              <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800">
                Accepted
              </span>
              {canUndo(booking) && (
                <button
                  type="button"
                  onClick={() => onUndoAccept(booking.id)}
                  disabled={processingBookingId === booking.id}
                  title={UI_CONTEXT.UNDO_LABEL}
                  className="h-9 w-9 flex items-center justify-center bg-emerald-100 text-emerald-800 rounded-lg hover:bg-emerald-200 disabled:opacity-50"
                >
                  <UndoIcon className="h-5 w-5" aria-hidden="true" />
                </button>
              )}
              {!booking.no_show && !isSlotExpired && (
                <NoShowButton bookingId={booking.id} onMarked={() => onNoShowMarked(booking.id)} />
              )}
            </>
          )}
          {booking.status === 'rejected' && canUndo(booking) && (
            <>
              <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-100 text-rose-900">
                Rejected
              </span>
              <button
                type="button"
                onClick={() => onUndoReject(booking.id)}
                disabled={processingBookingId === booking.id}
                title={UI_CONTEXT.UNDO_LABEL}
                className="h-9 w-9 flex items-center justify-center bg-rose-100 text-rose-900 rounded-lg hover:bg-rose-200 disabled:opacity-50"
              >
                <UndoIcon className="h-5 w-5" aria-hidden="true" />
              </button>
            </>
          )}
          {(booking.status === 'rejected' && !canUndo(booking)) ||
          booking.status === 'cancelled' ||
          String(booking.status) === 'expired' ? (
            <span
              className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                booking.status === 'rejected'
                  ? 'bg-rose-100 text-rose-900'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              {booking.status === 'rejected'
                ? 'Rejected'
                : booking.status === 'cancelled'
                  ? booking.cancelled_by === 'customer'
                    ? UI_CONTEXT.CANCELLED_BY_CUSTOMER
                    : 'Cancelled'
                  : 'Expired'}
            </span>
          ) : null}
        </div>
      </td>
    </tr>
  );
});
