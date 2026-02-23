'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { OwnerDashboardSkeleton } from '@/components/ui/skeleton';
import BookingCard from '@/components/owner/booking-card';
import PullToRefresh from '@/components/ui/pull-to-refresh';
import NoShowButton from '@/components/booking/no-show-button';
import { useOwnerSession } from '@/components/owner/owner-session-context';
import { BookingWithDetails, Slot } from '@/types';
import { UNDO_ACCEPT_REJECT_WINDOW_MINUTES, UI_CONTEXT } from '@/config/constants';

interface DashboardStats {
  totalBusinesses: number;
  totalBookings: number;
  confirmedBookings: number;
  pendingBookings: number;
  cancelledBookings: number;
}

export default function OwnerDashboardPage() {
  const { initialUser } = useOwnerSession();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [bookings, setBookings] = useState<BookingWithDetails[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [processingBookingId, setProcessingBookingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [lastUndoable, setLastUndoable] = useState<{
    bookingId: string;
    action: 'accept' | 'reject';
    at: number;
  } | null>(null);
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const undoWindowMs = UNDO_ACCEPT_REJECT_WINDOW_MINUTES * 60 * 1000;
  const isUndoWindowOpen = lastUndoable ? Date.now() - lastUndoable.at < undoWindowMs : false;

  useEffect(() => {
    if (!initialUser?.id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetch('/api/owner/dashboard-stats', { credentials: 'include' })
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((json) => {
        if (!cancelled && json?.data) setStats(json.data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [initialUser?.id]);

  const fetchBookings = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const date = selectedDate || new Date().toISOString().split('T')[0];

        const bizRes = await fetch('/api/owner/businesses', {
          credentials: 'include',
          signal: signal ?? undefined,
        });
        if (signal?.aborted || !bizRes.ok) return;
        const bizJson = await bizRes.json();
        const businesses = bizJson.data || [];

        const aggregated: BookingWithDetails[] = [];

        await Promise.all(
          businesses.map(async (b: any) => {
            if (signal?.aborted) return;
            try {
              const res = await fetch(`/api/bookings/salon/${b.id}?date=${date}`, {
                credentials: 'include',
                signal: signal ?? undefined,
              });
              if (signal?.aborted || !res.ok) return;
              const json = await res.json();
              if (json.success && Array.isArray(json.data)) {
                const items = json.data.map((it: any) => ({ ...it, salon: it.salon || b }));
                aggregated.push(...items);
              }
            } catch (err) {
              if ((err as Error)?.name !== 'AbortError')
                console.error('Failed to fetch salon bookings', b.id, err);
            }
          })
        );

        if (signal?.aborted) return;
        aggregated.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
        setBookings(aggregated);
      } catch (err) {
        if ((err as Error)?.name !== 'AbortError') console.error('Failed to fetch bookings', err);
      }
    },
    [selectedDate]
  );

  useEffect(() => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    fetchBookings(ac.signal);
    return () => ac.abort();
  }, [fetchBookings]);

  const handleAccept = async (bookingId: string) => {
    if (processingBookingId) return;
    if (!confirm('Are you sure you want to accept this booking?')) return;
    setProcessingBookingId(bookingId);
    setActionError(null);
    setActionSuccess(null);
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
        setActionSuccess('Booking accepted successfully');
        setTimeout(() => setActionSuccess(null), 2000);
        if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
        setLastUndoable({ bookingId, action: 'accept', at: Date.now() });
        undoTimeoutRef.current = setTimeout(() => setLastUndoable(null), undoWindowMs);
        fetchBookings();
      } else {
        const result = await response.json();
        setActionError(result.error || 'Failed to accept booking');
      }
    } catch (err) {
      setActionError('Failed to accept booking');
    } finally {
      setProcessingBookingId(null);
    }
  };

  const handleReject = async (bookingId: string) => {
    if (processingBookingId) return;
    if (!confirm('Are you sure you want to reject this booking?')) return;
    setProcessingBookingId(bookingId);
    setActionError(null);
    setActionSuccess(null);
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
        setActionSuccess('Booking rejected');
        setTimeout(() => setActionSuccess(null), 2000);
        if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
        setLastUndoable({ bookingId, action: 'reject', at: Date.now() });
        undoTimeoutRef.current = setTimeout(() => setLastUndoable(null), undoWindowMs);
        fetchBookings();
      } else {
        const result = await response.json();
        setActionError(result.error || 'Failed to reject booking');
      }
    } catch (err) {
      setActionError('Failed to reject booking');
    } finally {
      setProcessingBookingId(null);
    }
  };

  const handleUndoAccept = useCallback(
    async (bookingId: string) => {
      if (processingBookingId) return;
      setProcessingBookingId(bookingId);
      setActionError(null);
      setLastUndoable(null);
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
        undoTimeoutRef.current = null;
      }
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
          setActionSuccess(UI_CONTEXT.REVERTED_TO_PENDING);
          setTimeout(() => setActionSuccess(null), 2000);
          setBookings((prev) =>
            prev.map((b) => (b.id === bookingId ? { ...b, status: 'pending' as const } : b))
          );
          fetchBookings();
        } else {
          setActionError(json.error || 'Failed to undo');
        }
      } catch {
        setActionError('Failed to undo');
      } finally {
        setProcessingBookingId(null);
      }
    },
    [processingBookingId, fetchBookings]
  );

  const handleUndoReject = useCallback(
    async (bookingId: string) => {
      if (processingBookingId) return;
      setProcessingBookingId(bookingId);
      setActionError(null);
      setLastUndoable(null);
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
        undoTimeoutRef.current = null;
      }
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
          setActionSuccess(UI_CONTEXT.REVERTED_TO_PENDING);
          setTimeout(() => setActionSuccess(null), 2000);
          setBookings((prev) =>
            prev.map((b) => (b.id === bookingId ? { ...b, status: 'pending' as const } : b))
          );
          fetchBookings();
        } else {
          setActionError(json.error || 'Failed to undo');
        }
      } catch {
        setActionError('Failed to undo');
      } finally {
        setProcessingBookingId(null);
      }
    },
    [processingBookingId, fetchBookings]
  );

  const handleCancel = async (bookingId: string) => {
    if (processingBookingId) return;
    if (!confirm('Are you sure you want to cancel this booking?')) return;
    setProcessingBookingId(bookingId);
    setActionError(null);
    setActionSuccess(null);
    try {
      const csrfToken = await (await import('@/lib/utils/csrf-client')).getCSRFToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (csrfToken) headers['x-csrf-token'] = csrfToken;
      const response = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ cancelled_by: 'owner' }),
      });
      if (response.ok) {
        setActionSuccess('Booking cancelled');
        setTimeout(() => setActionSuccess(null), 2000);
        fetchBookings();
      } else {
        const result = await response.json();
        setActionError(result.error || 'Failed to cancel booking');
      }
    } catch (err) {
      setActionError('Failed to cancel booking');
    } finally {
      setProcessingBookingId(null);
    }
  };

  const canUndo = useCallback((b: BookingWithDetails) => {
    if (b.status !== 'confirmed' && b.status !== 'rejected') return false;
    if (b.undo_used_at) return false;
    const windowMs = UNDO_ACCEPT_REJECT_WINDOW_MINUTES * 60 * 1000;
    return Date.now() - new Date(b.updated_at).getTime() < windowMs;
  }, []);

  if (loading) return <OwnerDashboardSkeleton />;
  const filteredBookings = bookings.filter((booking) => {
    if (!searchTerm.trim()) return true;

    const term = searchTerm.toLowerCase();

    return (
      booking.customer_name?.toLowerCase().includes(term) ||
      booking.customer_phone?.toLowerCase().includes(term) ||
      booking.booking_id?.toLowerCase().includes(term) ||
      booking.salon?.salon_name?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="w-full pb-24 flex flex-col gap-6">
      {actionError && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span>{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="shrink-0 p-1 rounded hover:bg-amber-100"
            aria-label="Dismiss"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      )}
      {actionSuccess && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {actionSuccess}
        </div>
      )}
      {lastUndoable && (
        <div
          className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${
            lastUndoable.action === 'accept'
              ? 'border-emerald-200 bg-emerald-50'
              : 'border-rose-200 bg-rose-50'
          }`}
        >
          <span
            className={
              lastUndoable.action === 'accept'
                ? 'text-emerald-800 font-medium'
                : 'text-rose-900 font-medium'
            }
          >
            {lastUndoable.action === 'accept' ? 'Accepted.' : 'Rejected.'}
          </span>
          {isUndoWindowOpen && (
            <button
              type="button"
              onClick={() =>
                lastUndoable.action === 'accept'
                  ? handleUndoAccept(lastUndoable.bookingId)
                  : handleUndoReject(lastUndoable.bookingId)
              }
              disabled={!!processingBookingId}
              title={UI_CONTEXT.UNDO_LABEL}
              className={`h-9 w-9 flex items-center justify-center rounded-lg disabled:opacity-50 ${
                lastUndoable.action === 'accept'
                  ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                  : 'bg-rose-100 text-rose-900 hover:bg-rose-200'
              }`}
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3"
                />
              </svg>
            </button>
          )}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 gap-6">
        <Stat label="Total Businesses" value={stats?.totalBusinesses ?? 0} />
        <Stat label="Total Bookings" value={stats?.totalBookings ?? 0} />
        <Stat label="Confirmed" value={stats?.confirmedBookings ?? 0} />
        <Stat label="Pending" value={stats?.pendingBookings ?? 0} />
      </div>
      <div>
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Your Customers</h2>
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            {/* Left */}
            <h2 className="text-lg font-semibold">Bookings</h2>

            {/* Right */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowSearch((prev) => !prev)}
                className="h-9 w-9 flex items-center justify-center rounded-lg border border-gray-300 bg-white hover:bg-gray-50 transition"
              >
                <svg
                  className="h-4 w-4 text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-4.35-4.35M16 10a6 6 0 11-12 0 6 6 0 0112 0z"
                  />
                </svg>
              </button>

              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-9 px-3 text-sm border border-gray-300 rounded-lg"
              />
            </div>
          </div>

          {showSearch && (
            <div className="mb-4">
              <input
                type="text"
                placeholder="Search by name, booking ID, phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-9 px-4 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                autoFocus
              />
            </div>
          )}

          <div className="lg:hidden">
            <PullToRefresh onRefresh={async () => fetchBookings()}>
              <div className="space-y-4">
                {filteredBookings.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500">No bookings for selected date</p>
                  </div>
                ) : (
                  filteredBookings.map((booking) => (
                    <BookingCard
                      key={booking.id}
                      booking={booking}
                      onAccept={handleAccept}
                      onReject={handleReject}
                      processingId={processingBookingId}
                      actionError={actionError}
                      actionSuccess={actionSuccess}
                      onRescheduled={fetchBookings}
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
            {bookings.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">No bookings for selected date</p>
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
                        Status & actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {bookings.map((booking) => (
                      <tr key={booking.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {booking.customer_name}
                          </div>
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
                          <span className="text-sm text-gray-500 font-mono">
                            {booking.booking_id}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{booking.salon?.salon_name}</div>
                        </td>
                        <td className="px-6 py-4 text-sm font-medium">
                          <div className="flex flex-wrap items-center gap-2">
                            {booking.status === 'pending' && (
                              <>
                                <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-700">
                                  Pending
                                </span>
                                <button
                                  onClick={() => handleAccept(booking.id)}
                                  disabled={processingBookingId === booking.id}
                                  className="h-9 w-9 flex items-center justify-center bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                                  title="Accept"
                                >
                                  {processingBookingId === booking.id ? (
                                    <svg
                                      className="animate-spin h-5 w-5"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                    >
                                      <circle
                                        className="opacity-25"
                                        cx="12"
                                        cy="12"
                                        r="10"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                      />
                                      <path
                                        className="opacity-75"
                                        fill="currentColor"
                                        d="M4 12a8 8 0 018-8v8z"
                                      />
                                    </svg>
                                  ) : (
                                    <svg
                                      className="h-5 w-5"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M5 13l4 4L19 7"
                                      />
                                    </svg>
                                  )}
                                </button>
                                <button
                                  onClick={() => handleReject(booking.id)}
                                  disabled={processingBookingId === booking.id}
                                  className="h-9 w-9 flex items-center justify-center bg-rose-900 text-white rounded-lg hover:bg-rose-800"
                                  title="Reject"
                                >
                                  <svg
                                    className="h-5 w-5"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M6 18L18 6M6 6l12 12"
                                    />
                                  </svg>
                                </button>
                              </>
                            )}
                            {booking.status === 'confirmed' && (
                              <>
                                <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800">
                                  Accepted
                                </span>
                                {canUndo(booking) && (
                                  <button
                                    type="button"
                                    onClick={() => handleUndoAccept(booking.id)}
                                    disabled={processingBookingId === booking.id}
                                    title={UI_CONTEXT.UNDO_LABEL}
                                    className="h-9 w-9 flex items-center justify-center bg-emerald-100 text-emerald-800 rounded-lg hover:bg-emerald-200 disabled:opacity-50"
                                  >
                                    <svg
                                      className="h-5 w-5"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      viewBox="0 0 24 24"
                                      aria-hidden
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3"
                                      />
                                    </svg>
                                  </button>
                                )}
                                {!booking.no_show && (
                                  <NoShowButton bookingId={booking.id} onMarked={fetchBookings} />
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
                                  onClick={() => handleUndoReject(booking.id)}
                                  disabled={processingBookingId === booking.id}
                                  title={UI_CONTEXT.UNDO_LABEL}
                                  className="h-9 w-9 flex items-center justify-center bg-rose-100 text-rose-900 rounded-lg hover:bg-rose-200 disabled:opacity-50"
                                >
                                  <svg
                                    className="h-5 w-5"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    viewBox="0 0 24 24"
                                    aria-hidden
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3"
                                    />
                                  </svg>
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-6">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="text-3xl font-bold text-slate-900">{value}</div>
    </div>
  );
}
