'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { OwnerDashboardSkeleton } from '@/components/ui/skeleton';
import BookingCard from '@/components/owner/booking-card';
import PullToRefresh from '@/components/ui/pull-to-refresh';
import NoShowButton from '@/components/booking/no-show-button';
import { useOwnerSession } from '@/components/owner/owner-session-context';
import { BookingWithDetails, Slot } from '@/types';
import { IconCheck, IconCross, IconUndo } from '@/components/ui/status-icons';
import { BOOKING_STATUS } from '@/config/constants';

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

  // Optimistic Accept/Reject with Undo
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
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Booking ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Business
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
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
                          <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-black">
                            {booking.status}
                          </span>
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
                          <div className="flex flex-wrap gap-2 items-center">
                            {booking.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => handleAccept(booking.id)}
                                  disabled={processingBookingId === booking.id}
                                  className="h-9 w-9 flex items-center justify-center text-green-600 disabled:opacity-50 hover:text-green-700 transition"
                                  title="Accept"
                                  aria-label="Accept booking"
                                >
                                  <IconCheck className="h-6 w-6" />
                                </button>
                                <button
                                  onClick={() => handleReject(booking.id)}
                                  disabled={processingBookingId === booking.id}
                                  className="h-9 w-9 flex items-center justify-center text-red-600 disabled:opacity-50 hover:text-red-700 transition"
                                  title="Reject"
                                  aria-label="Reject booking"
                                >
                                  <IconCross className="h-6 w-6" />
                                </button>
                              </>
                            )}
                            {booking.status === 'confirmed' && !booking.no_show && (
                              <NoShowButton bookingId={booking.id} onMarked={fetchBookings} />
                            )}
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
