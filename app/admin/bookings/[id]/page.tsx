'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabaseAuth } from '@/lib/supabase/auth';
import { ROUTES } from '@/lib/utils/navigation';
import AdminSidebar from '@/components/admin/admin-sidebar';
import { AdminDashboardSkeleton } from '@/components/ui/skeleton';

export default function AdminBookingPage() {
  const router = useRouter();
  const params = useParams();
  const bookingId = params?.id as string;

  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const loadBooking = useCallback(async () => {
    try {
      if (!supabaseAuth) {
        setError('Supabase not configured');
        setLoading(false);
        return;
      }

      const {
        data: { session },
      } = await supabaseAuth.auth.getSession();
      if (!session) {
        router.push(ROUTES.AUTH_LOGIN(ROUTES.ADMIN_BOOKING(bookingId)));
        return;
      }

      const res = await fetch(`/api/admin/bookings/${bookingId}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        if (res.status === 404) {
          setError('Booking not found');
        } else if (res.status === 403) {
          setError('You do not have permission to view this booking');
        } else {
          setError('Failed to load booking');
        }
        setLoading(false);
        return;
      }

      const data = await res.json();
      if (data.success) {
        setBooking(data.data);
      } else {
        setError(data.error || 'Failed to load booking');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load booking');
    } finally {
      setLoading(false);
    }
  }, [bookingId, router]);

  useEffect(() => {
    loadBooking();
  }, [loadBooking]);

  const handleAction = async (action: 'accept' | 'reject' | 'cancel', reason?: string) => {
    if (!booking) return;

    setActionLoading(true);
    try {
      if (!supabaseAuth) {
        setError('Supabase not configured');
        return;
      }

      const {
        data: { session },
      } = await supabaseAuth.auth.getSession();
      if (!session) {
        router.push(ROUTES.AUTH_LOGIN(ROUTES.ADMIN_BOOKING(bookingId)));
        return;
      }

      let endpoint = '';
      let body: any = {};

      if (action === 'accept') {
        endpoint = `/api/bookings/${bookingId}/accept`;
      } else if (action === 'reject') {
        endpoint = `/api/bookings/${bookingId}/reject`;
        body = { reason: reason || 'Rejected by admin' };
      } else if (action === 'cancel') {
        endpoint = `/api/bookings/${bookingId}/cancel`;
        body = { reason: reason || 'Cancelled by admin' };
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (data.success) {
        // Reload booking to get updated status
        await loadBooking();
      } else {
        setError(data.error || `Failed to ${action} booking`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} booking`);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <AdminDashboardSkeleton />;
  }

  if (error && !booking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Error</h2>
          <p className="text-gray-600 mb-8">{error}</p>
          <button
            onClick={() => router.push(ROUTES.ADMIN_DASHBOARD)}
            className="px-6 py-3 bg-black text-white font-semibold rounded-lg hover:bg-gray-900 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminSidebar />
      <div className="lg:pl-64">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-6">
            <button
              onClick={() => router.push(ROUTES.ADMIN_DASHBOARD + '?tab=bookings')}
              className="text-gray-600 hover:text-gray-900 mb-4 inline-flex items-center"
            >
              ← Back to Bookings
            </button>
            <h1 className="text-3xl font-bold text-gray-900">Booking Details</h1>
          </div>

          {booking && (
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Customer Information</h2>
                  <div className="space-y-2">
                    <p>
                      <span className="font-medium">Name:</span> {booking.customer_name || 'N/A'}
                    </p>
                    <p>
                      <span className="font-medium">Phone:</span> {booking.customer_phone || 'N/A'}
                    </p>
                    {booking.customer_user_id && (
                      <p>
                        <span className="font-medium">User ID:</span>{' '}
                        <span className="text-xs font-mono">
                          {booking.customer_user_id.substring(0, 8)}...
                        </span>
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Business Information</h2>
                  <div className="space-y-2">
                    <p>
                      <span className="font-medium">Business:</span>{' '}
                      {booking.business?.salon_name || booking.business?.name || 'N/A'}
                    </p>
                    <p>
                      <span className="font-medium">Location:</span>{' '}
                      {booking.business?.location || 'N/A'}
                    </p>
                    <p>
                      <span className="font-medium">Phone:</span>{' '}
                      {booking.business?.whatsapp_number || 'N/A'}
                    </p>
                  </div>
                </div>

                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Booking Details</h2>
                  <div className="space-y-2">
                    <p>
                      <span className="font-medium">Booking ID:</span>{' '}
                      <span className="text-xs font-mono">
                        {booking.booking_id || booking.id.substring(0, 8)}
                      </span>
                    </p>
                    <p>
                      <span className="font-medium">Status:</span>
                      <span
                        className={`ml-2 px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          booking.status === 'confirmed'
                            ? 'bg-green-100 text-green-800'
                            : booking.status === 'rejected'
                              ? 'bg-red-100 text-red-800'
                              : booking.status === 'pending'
                                ? 'bg-yellow-100 text-yellow-800'
                                : booking.status === 'cancelled'
                                  ? 'bg-gray-100 text-gray-800'
                                  : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {booking.status}
                      </span>
                    </p>
                    {booking.slot && (
                      <>
                        <p>
                          <span className="font-medium">Date:</span>{' '}
                          {new Date(booking.slot.date).toLocaleDateString()}
                        </p>
                        <p>
                          <span className="font-medium">Time:</span> {booking.slot.start_time} -{' '}
                          {booking.slot.end_time}
                        </p>
                      </>
                    )}
                    <p>
                      <span className="font-medium">Created:</span>{' '}
                      {new Date(booking.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions</h2>
                  <div className="space-y-2">
                    {booking.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleAction('accept')}
                          disabled={actionLoading}
                          className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                        >
                          {actionLoading ? 'Processing...' : 'Accept Booking'}
                        </button>
                        <button
                          onClick={() => {
                            const reason = prompt('Rejection reason (optional):');
                            if (reason !== null) handleAction('reject', reason);
                          }}
                          disabled={actionLoading}
                          className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                        >
                          {actionLoading ? 'Processing...' : 'Reject Booking'}
                        </button>
                      </>
                    )}
                    {booking.status === 'confirmed' && (
                      <button
                        onClick={() => {
                          const reason = prompt('Cancellation reason (optional):');
                          if (reason !== null) handleAction('cancel', reason);
                        }}
                        disabled={actionLoading}
                        className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
                      >
                        {actionLoading ? 'Processing...' : 'Cancel Booking'}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {booking.cancellation_reason && (
                <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">
                    <span className="font-medium">Cancellation Reason:</span>{' '}
                    {booking.cancellation_reason}
                  </p>
                  {booking.cancelled_at && (
                    <p className="text-xs text-red-600 mt-1">
                      Cancelled on: {new Date(booking.cancelled_at).toLocaleString()}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
