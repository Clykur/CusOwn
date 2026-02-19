'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseAuth } from '@/lib/supabase/auth';
import { ROUTES } from '@/lib/utils/navigation';
import { OwnerDashboardSkeleton } from '@/components/ui/skeleton';
import BookingCard from '@/components/owner/booking-card';
import PullToRefresh from '@/components/ui/pull-to-refresh';
import NoShowButton from '@/components/booking/no-show-button';
import { BookingWithDetails, Slot } from '@/types';

interface DashboardStats {
  totalBusinesses: number;
  totalBookings: number;
  confirmedBookings: number;
  pendingBookings: number;
  cancelledBookings: number;
}

export default function OwnerDashboardPage() {
  const router = useRouter();
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
    const run = async () => {
      const { data } = await supabaseAuth.auth.getSession();
      if (!data.session) {
        router.replace(ROUTES.AUTH_LOGIN('/owner/dashboard'));
        return;
      }

      const res = await fetch('/api/owner/dashboard-stats', {
        headers: {
          Authorization: `Bearer ${data.session.access_token}`,
        },
      });

      if (!res.ok) {
        router.replace('/owner/businesses');
        return;
      }

      const json = await res.json();
      setStats(json.data);
      setLoading(false);
    };

    run();
  }, [router]);

  const fetchBookings = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabaseAuth.auth.getSession();
      if (!session?.access_token) return;
      const date = selectedDate || new Date().toISOString().split('T')[0];

      // Get businesses owned by this user
      const bizRes = await fetch('/api/owner/businesses', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        credentials: 'include',
      });
      if (!bizRes.ok) return;
      const bizJson = await bizRes.json();
      const businesses = bizJson.data || [];

      const aggregated: BookingWithDetails[] = [];

      // Fetch bookings per salon and aggregate
      await Promise.all(
        businesses.map(async (b: any) => {
          try {
            const res = await fetch(`/api/bookings/salon/${b.id}?date=${date}`, {
              headers: { Authorization: `Bearer ${session.access_token}` },
              credentials: 'include',
            });
            if (!res.ok) return;
            const json = await res.json();
            if (json.success && Array.isArray(json.data)) {
              // Attach salon reference if not present
              const items = json.data.map((it: any) => ({ ...it, salon: it.salon || b }));
              aggregated.push(...items);
            }
          } catch (err) {
            console.error('Failed to fetch salon bookings', b.id, err);
          }
        })
      );

      // Sort aggregated by created_at desc (same as salon endpoint)
      aggregated.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      setBookings(aggregated);
    } catch (err) {
      console.error('Failed to fetch bookings', err);
    }
  }, [selectedDate]);

  useEffect(() => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const handleAccept = async (bookingId: string) => {
    if (processingBookingId) return;
    if (!confirm('Are you sure you want to accept this booking?')) return;
    setProcessingBookingId(bookingId);
    setActionError(null);
    setActionSuccess(null);
    try {
      const csrfToken = await (await import('@/lib/utils/csrf-client')).getCSRFToken();
      const {
        data: { session },
      } = await supabaseAuth.auth.getSession();
      const headers: Record<string, string> = {};
      if (csrfToken) headers['x-csrf-token'] = csrfToken;
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
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
      const {
        data: { session },
      } = await supabaseAuth.auth.getSession();
      const headers: Record<string, string> = {};
      if (csrfToken) headers['x-csrf-token'] = csrfToken;
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
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

  const handleCancel = async (bookingId: string) => {
    if (processingBookingId) return;
    if (!confirm('Are you sure you want to cancel this booking?')) return;
    setProcessingBookingId(bookingId);
    setActionError(null);
    setActionSuccess(null);
    try {
      const csrfToken = await (await import('@/lib/utils/csrf-client')).getCSRFToken();
      const {
        data: { session },
      } = await supabaseAuth.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (csrfToken) headers['x-csrf-token'] = csrfToken;
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
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
    <div className="w-full px-4 pt-0 sm:px-6 py-6 pb-24">
      <div className="max-w-6xl">
        {/* <h1 className="text-2xl font-bold mb-8 md:block">Owner Dashboard</h1> */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 gap-6 mb-10">
          <Stat label="Total Businesses" value={stats!.totalBusinesses} />
          <Stat label="Total Bookings" value={stats!.totalBookings} />
          <Stat label="Confirmed" value={stats!.confirmedBookings} />
          <Stat label="Pending" value={stats!.pendingBookings} />
        </div>
      </div>
      <h1 className="text-2xl font-bold mb-8 md:block">Your Customers</h1>
      {/* Bookings Section - aggregated across businesses */}
      <div className="max-w-6xl bg-white border border-gray-200 rounded-lg p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          {/* Left Side */}
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">Bookings</h2>

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
          </div>

          {/* Right Side */}
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="h-9 px-3 text-sm border border-gray-300 rounded-lg"
          />
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex gap-2">
                          {booking.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleAccept(booking.id)}
                                disabled={processingBookingId === booking.id}
                                className="h-9 w-9 flex items-center justify-center bg-black text-white rounded-lg"
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
                                    ></circle>
                                    <path
                                      className="opacity-75"
                                      fill="currentColor"
                                      d="M4 12a8 8 0 018-8v8z"
                                    ></path>
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
                                className="h-9 w-9 flex items-center justify-center bg-gray-200 text-gray-800 rounded-lg"
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
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-3xl font-bold">{value}</div>
    </div>
  );
}
