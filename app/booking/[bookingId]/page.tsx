'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { UI_BOOKING_STATE, UI_CONTEXT, UI_ERROR_CONTEXT } from '@/config/constants';
import { formatDate, formatTime } from '@/lib/utils/string';
import { handleApiError } from '@/lib/utils/error-handler';
import RescheduleButton from '@/components/booking/reschedule-button';
import { ROUTES, getSecureSalonUrlClient } from '@/lib/utils/navigation';
import { getCSRFToken, clearCSRFToken } from '@/lib/utils/csrf-client';
import Breadcrumb from '@/components/ui/breadcrumb';
import { BookingStatusSkeleton } from '@/components/ui/skeleton';

export default function BookingStatusPage() {
  const params = useParams();
  const bookingId = params.bookingId as string;
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);
  const [salonSecureUrl, setSalonSecureUrl] = useState<string>('');
  const [secureBookingUrls, setSecureBookingUrls] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    // Pre-fetch CSRF token
    getCSRFToken().catch(console.error);
  }, []);

  useEffect(() => {
    if (!bookingId) return;
    fetchBooking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  const fetchBooking = async () => {
    // Extract token from URL if present (for secure access)
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    try {
      // Build URL with token if available
      let url = `/api/bookings/booking-id/${bookingId}`;
      if (token) {
        url += `?token=${encodeURIComponent(token)}`;
      }
      
      // If token is missing and bookingId is a UUID, try to generate secure URL
      if (!token && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookingId)) {
        try {
          const { getSecureBookingStatusUrlClient } = await import('@/lib/utils/navigation');
          const secureUrl = await getSecureBookingStatusUrlClient(bookingId);
          // Redirect to secure URL
          window.location.href = secureUrl;
          return;
        } catch (urlError) {
          console.error('Failed to generate secure URL:', urlError);
        }
      }

      const response = await fetch(url);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Booking not found');
      }

      if (result.success && result.data) {
        setBooking(result.data);
        
        // Generate secure URL for this booking
        try {
          const { getSecureBookingStatusUrlClient } = await import('@/lib/utils/navigation');
          const secureUrl = await getSecureBookingStatusUrlClient(result.data.booking_id);
          setSecureBookingUrls(new Map([[result.data.booking_id, secureUrl]]));
        } catch (urlError) {
          console.error('Failed to generate secure booking URL:', urlError);
        }
        
        if (result.data.salon && result.data.slot) {
          fetchAvailableSlots(result.data.salon.id, result.data.slot.date);
        }
        // Generate secure URL for salon
        if (result.data.salon?.id) {
          getSecureSalonUrlClient(result.data.salon.id)
            .then(url => setSalonSecureUrl(url))
            .catch(() => {});
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load booking');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableSlots = async (businessId: string, date: string) => {
    try {
      const response = await fetch(`/api/slots?salon_id=${businessId}&date=${date}`);
      const result = await response.json();
      if (result.success && result.data) {
        setAvailableSlots(result.data);
      }
    } catch (err) {
      console.error('Failed to fetch slots:', err);
    }
  };

  const handleCancel = async () => {
    if (cancelling) return;
    if (!confirm('Are you sure you want to cancel this booking?')) return;

    setCancelling(true);
    try {
      const csrfToken = await getCSRFToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (csrfToken) {
        headers['x-csrf-token'] = csrfToken;
      }
      const response = await fetch(`/api/bookings/${booking.id}/cancel`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ cancelled_by: 'customer' }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to cancel booking');
      }

      await fetchBooking();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to cancel booking');
      clearCSRFToken();
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return <BookingStatusSkeleton />;
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Booking Not Found</h2>
          <p className="text-gray-600 mb-8">{UI_ERROR_CONTEXT.BOOKING_PAGE}</p>
          <Link href={ROUTES.HOME} className="inline-block px-6 py-3 bg-black text-white font-semibold rounded-lg hover:bg-gray-900 transition-colors">
            Go to Home
          </Link>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-black text-white';
      case 'pending':
        return 'bg-gray-200 text-black';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'cancelled':
        return 'bg-gray-300 text-black';
      default:
        return 'bg-gray-200 text-black';
    }
  };

  const getStatusMessage = (status: string) => {
    switch (status) {
      case 'confirmed':
        return UI_BOOKING_STATE.CONFIRMED;
      case 'pending':
        return UI_BOOKING_STATE.PENDING;
      case 'rejected':
        return UI_BOOKING_STATE.REJECTED;
      case 'cancelled':
        return booking.cancelled_by === 'system' ? UI_BOOKING_STATE.EXPIRED : UI_BOOKING_STATE.CANCELLED;
      default:
        return status;
    }
  };

  const canCancel = booking.status === 'confirmed' || booking.status === 'pending';

  return (
    <div className="min-h-screen bg-white flex">
      <div className="flex-1 lg:ml-64">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Breadcrumb items={[
            { label: 'Home', href: ROUTES.HOME },
            { label: 'My Bookings', href: ROUTES.CUSTOMER_DASHBOARD },
            { label: 'Booking Details', href: booking ? (secureBookingUrls.get(booking.booking_id) || ROUTES.BOOKING_STATUS(booking.booking_id)) : '#' },
          ]} />
          <div className="bg-white rounded-2xl shadow-xl p-8 border-2 border-gray-200">
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">Booking Status</h1>
            <p className="text-sm text-gray-600 mb-3">{UI_CONTEXT.BOOKING_STATUS_SINGLE}</p>
            <div className="flex items-center gap-2 text-gray-600">
              <span>Booking ID:</span>
              <span className="font-mono text-sm bg-gray-100 px-3 py-1 rounded-lg">{booking.booking_id}</span>
            </div>
          </div>

          <div className={`px-6 py-4 rounded-xl mb-8 border-2 ${
            booking.status === 'confirmed' ? 'bg-green-50 border-green-200 text-green-800' :
            booking.status === 'pending' ? 'bg-yellow-50 border-yellow-200 text-yellow-800' :
            booking.status === 'rejected' ? 'bg-red-50 border-red-200 text-red-800' :
            'bg-gray-50 border-gray-200 text-gray-800'
          }`}>
            <div className="flex items-center gap-3">
              {booking.status === 'confirmed' ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : booking.status === 'pending' ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : null}
              <p className="font-bold text-lg">{getStatusMessage(booking.status)}</p>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2 mb-8">
            {booking.salon && (
              <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  Business Details
                </h2>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Business Name</p>
                    <p className="font-semibold text-gray-900">{booking.salon.salon_name}</p>
                  </div>
                  {booking.salon.location && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Location</p>
                      <p className="text-gray-700">{booking.salon.location}</p>
                    </div>
                  )}
                  {booking.salon.address && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Address</p>
                      <p className="text-sm text-gray-600">{booking.salon.address}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {booking.slot && (
              <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Appointment Details
                </h2>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Date</p>
                    <p className="font-semibold text-gray-900">{formatDate(booking.slot.date)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Time</p>
                    <p className="font-semibold text-gray-900">{formatTime(booking.slot.start_time)} - {formatTime(booking.slot.end_time)}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-gray-50 rounded-xl p-6 border border-gray-200 mb-8">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Your Details
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Name</p>
                <p className="font-semibold text-gray-900">{booking.customer_name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Phone</p>
                <p className="font-semibold text-gray-900">{booking.customer_phone}</p>
              </div>
            </div>
          </div>

          {booking.cancelled_at && (
            <div className="mb-6 bg-gray-100 p-4 rounded-lg">
              <p className="font-medium text-gray-900">Cancellation Details</p>
              <p className="text-sm text-gray-600 mt-1">
                Cancelled {booking.cancelled_by === 'customer' ? 'by you' : booking.cancelled_by === 'owner' ? 'by business owner' : 'automatically'} on {new Date(booking.cancelled_at).toLocaleString()}
              </p>
              {booking.cancellation_reason && (
                <p className="text-sm text-gray-600 mt-1">Reason: {booking.cancellation_reason}</p>
              )}
            </div>
          )}

          {canCancel && (
            <div className="mb-6 space-y-3">
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="w-full bg-red-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cancelling ? 'Cancelling...' : 'Cancel Booking'}
              </button>
              {booking.slot && booking.salon && availableSlots.length > 0 && !booking.no_show && (
                <div className="flex justify-center">
                  <RescheduleButton
                    bookingId={booking.id}
                    currentSlot={booking.slot}
                    businessId={booking.business_id}
                    availableSlots={availableSlots}
                    onRescheduled={fetchBooking}
                    rescheduledBy="customer"
                  />
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-gray-200">
            {booking.salon && (
              <Link
                href={salonSecureUrl || ROUTES.SALON_DETAIL(booking.salon.id)}
                className="flex-1 inline-flex items-center justify-center gap-2 text-center bg-black text-white font-semibold py-3 px-6 rounded-xl hover:bg-gray-900 transition-all shadow-lg hover:shadow-xl"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Book Another Slot
              </Link>
            )}
            <Link
              href={ROUTES.CUSTOMER_DASHBOARD}
              className="flex-1 inline-flex items-center justify-center gap-2 text-center bg-gray-100 text-gray-800 font-semibold py-3 px-6 rounded-xl hover:bg-gray-200 transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              View All Bookings
            </Link>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
