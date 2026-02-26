'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  UI_BOOKING_STATE,
  UI_CONTEXT,
  UI_CUSTOMER,
  UI_ERROR_CONTEXT,
  ERROR_MESSAGES,
  CANCELLATION_MIN_HOURS_BEFORE,
} from '@/config/constants';
import { formatDate, formatTime } from '@/lib/utils/string';
import RescheduleButton from '@/components/booking/reschedule-button';
import { ROUTES, getSecureSalonUrlClient } from '@/lib/utils/navigation';
import { getCSRFToken, clearCSRFToken } from '@/lib/utils/csrf-client';
import { BookingStatusSkeleton } from '@/components/ui/skeleton';
import { supabaseAuth } from '@/lib/supabase/auth';
import WarningIcon from '@/src/icons/warning.svg';
import CheckIcon from '@/src/icons/check.svg';
import ClockIcon from '@/src/icons/clock.svg';
import BusinessesIcon from '@/src/icons/businesses.svg';
import BookingsIcon from '@/src/icons/bookings.svg';
import ProfileIcon from '@/src/icons/profile.svg';

export default function BookingStatusPage() {
  const params = useParams();
  const bookingId = typeof params?.bookingId === 'string' ? params.bookingId : '';
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);
  const [salonSecureUrl, setSalonSecureUrl] = useState<string>('');
  const [secureBookingUrls, setSecureBookingUrls] = useState<Map<string, string>>(new Map());
  const [refreshingStatus, setRefreshingStatus] = useState(false);
  const [whatsappUrl, setWhatsappUrl] = useState<string | null>(null);
  const [whatsappMessage, setWhatsappMessage] = useState<string | null>(null);

  useEffect(() => {
    // Pre-fetch CSRF token
    getCSRFToken().catch(console.error);
  }, []);

  useEffect(() => {
    if (!bookingId) return;
    fetchBooking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  // Refetch when user returns to the tab so status updates (e.g. owner undo) are visible
  useEffect(() => {
    if (!bookingId || !booking) return;
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') fetchBooking({ silent: true });
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId, booking]);

  const handleRefreshStatus = async () => {
    if (refreshingStatus || !bookingId) return;
    setRefreshingStatus(true);
    await fetchBooking({ silent: true });
    setRefreshingStatus(false);
  };

  const fetchBooking = async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true;
    // Extract token from URL if present (for secure access)
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (!silent) setLoading(true);
    try {
      // Build URL with token if available
      let url = `/api/bookings/booking-id/${bookingId}`;
      if (token) {
        url += `?token=${encodeURIComponent(token)}`;
      }

      // If token is missing and bookingId is a UUID, try to generate secure URL
      if (
        !token &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookingId)
      ) {
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

      const {
        data: { session },
      } = await supabaseAuth.auth.getSession();

      const headers: HeadersInit = {};
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const response = await fetch(url, {
        credentials: 'include',
        cache: 'no-store',
        headers: Object.keys(headers).length > 0 ? headers : undefined,
      });
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
            .then((url) => setSalonSecureUrl(url))
            .catch(() => {});
        }

        // Request server-derived WhatsApp link (no query params used)
        try {
          const wRes = await fetch(`/api/bookings/${result.data.booking_id}/whatsapp`, {
            credentials: 'include',
          });
          const wj = await wRes.json();
          if (wj?.success && wj?.data?.whatsapp_url) setWhatsappUrl(wj.data.whatsapp_url);
        } catch (e) {
          // ignore — non-fatal
        }
      }
    } catch (err) {
      if (!silent) setError(err instanceof Error ? err.message : 'Failed to load booking');
    } finally {
      if (!silent) setLoading(false);
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
    if (isCancellationTooLate) return;
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

      // Optimistic state update
      setBooking((prev: any) => ({
        ...prev,
        status: 'cancelled',
        cancelled_by: 'customer',
        cancelled_at: new Date().toISOString(),
      }));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to cancel booking');
      clearCSRFToken();
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full pb-24 flex flex-col gap-8">
        <BookingStatusSkeleton />
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="w-full pb-24 flex flex-col gap-8">
        <div className="w-full">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm text-center">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">
              {UI_ERROR_CONTEXT.ACCEPT_REJECT_PAGE}
            </h2>
            <p className="text-slate-600 mb-6">{error || 'Booking not found.'}</p>
            <Link
              href={ROUTES.CUSTOMER_DASHBOARD}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 transition shadow-sm"
            >
              {UI_CUSTOMER.NAV_MY_ACTIVITY}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const getStatusMessage = (status: string) => {
    if (status === 'confirmed' && booking.no_show) return UI_BOOKING_STATE.NO_SHOW;
    switch (status) {
      case 'confirmed':
        return UI_BOOKING_STATE.CONFIRMED;
      case 'pending':
        return UI_BOOKING_STATE.PENDING;
      case 'rejected':
        return UI_BOOKING_STATE.REJECTED;
      case 'cancelled':
        return booking.cancelled_by === 'system'
          ? UI_BOOKING_STATE.EXPIRED
          : UI_BOOKING_STATE.CANCELLED;
      default:
        return status;
    }
  };

  const isNoShow = booking.status === 'confirmed' && booking.no_show;

  const canCancelByStatus = booking.status === 'confirmed' || booking.status === 'pending';
  const appointmentDateTime = (() => {
    if (!booking?.slot?.date || !booking?.slot?.start_time) return null;
    const startTimeRaw = String(booking.slot.start_time);
    const startTime = startTimeRaw.includes('T')
      ? new Date(startTimeRaw)
      : new Date(`${booking.slot.date}T${startTimeRaw}`);
    const timeMs = startTime.getTime();
    if (!Number.isFinite(timeMs)) return null;
    return startTime;
  })();
  const msUntilAppointment = appointmentDateTime
    ? appointmentDateTime.getTime() - Date.now()
    : Number.POSITIVE_INFINITY;
  const minCancellationWindowMs = CANCELLATION_MIN_HOURS_BEFORE * 60 * 60 * 1000;
  const isCancellationTooLate =
    canCancelByStatus &&
    Number.isFinite(msUntilAppointment) &&
    msUntilAppointment < minCancellationWindowMs;
  const canCancel = canCancelByStatus;

  return (
    <div className="w-full pb-24 flex flex-col gap-8">
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-slate-900 mb-2">
            {UI_CUSTOMER.HEADER_BOOKING_DETAILS}
          </h1>
          <p className="text-sm text-slate-600 mb-3">{UI_CONTEXT.BOOKING_STATUS_SINGLE}</p>
          <div className="flex flex-wrap items-center gap-2 text-slate-600">
            <span className="text-sm">{UI_CUSTOMER.LABEL_BOOKING_ID}:</span>
            <span className="font-mono text-sm bg-slate-100 px-3 py-1 rounded-xl text-slate-900">
              {booking.booking_id}
            </span>
            <button
              type="button"
              onClick={handleRefreshStatus}
              disabled={refreshingStatus}
              className="text-sm font-medium text-slate-600 hover:text-slate-900 underline hover:no-underline disabled:opacity-50"
            >
              {refreshingStatus ? 'Refreshing…' : 'Refresh status'}
            </button>
            {whatsappUrl && (
              <div className="w-full mt-3">
                <button
                  type="button"
                  onClick={() => window.open(whatsappUrl, '_blank')}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800"
                >
                  Open WhatsApp
                </button>
              </div>
            )}
          </div>
        </div>

        <div
          className={`px-6 py-4 rounded-xl mb-8 border-2 ${
            isNoShow
              ? 'bg-amber-50 border-amber-200 text-amber-800'
              : booking.status === 'confirmed'
                ? 'bg-green-50 border-green-200 text-green-800'
                : booking.status === 'pending'
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : booking.status === 'rejected'
                    ? 'bg-red-50 border-red-200 text-red-800'
                    : 'bg-slate-50 border-slate-200 text-slate-800'
          }`}
        >
          <div className="flex items-center gap-3">
            {isNoShow ? (
              <WarningIcon className="w-6 h-6 shrink-0" aria-hidden="true" />
            ) : booking.status === 'confirmed' ? (
              <CheckIcon className="w-6 h-6" aria-hidden="true" />
            ) : booking.status === 'pending' ? (
              <ClockIcon className="w-6 h-6" aria-hidden="true" />
            ) : null}
            <p className="font-bold text-lg">{getStatusMessage(booking.status)}</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 mb-8">
          {booking.salon && (
            <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <BusinessesIcon className="w-5 h-5 text-slate-600" aria-hidden="true" />
                Business Details
              </h2>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                    Business Name
                  </p>
                  <p className="font-semibold text-slate-900">{booking.salon.salon_name}</p>
                </div>
                {booking.salon.location && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Location</p>
                    <p className="text-slate-700">{booking.salon.location}</p>
                  </div>
                )}
                {booking.salon.address && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Address</p>
                    <p className="text-sm text-slate-600">{booking.salon.address}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {booking.slot && (
            <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <BookingsIcon className="w-5 h-5 text-slate-600" aria-hidden="true" />
                Appointment Details
              </h2>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Date</p>
                  <p className="font-semibold text-slate-900">{formatDate(booking.slot.date)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Time</p>
                  <p className="font-semibold text-slate-900">
                    {formatTime(booking.slot.start_time)} - {formatTime(booking.slot.end_time)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-slate-50 rounded-xl p-6 border border-slate-200 mb-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <ProfileIcon className="w-5 h-5 text-slate-600" aria-hidden="true" />
            Your Details
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Name</p>
              <p className="font-semibold text-slate-900">{booking.customer_name}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Phone</p>
              <p className="font-semibold text-slate-900">{booking.customer_phone}</p>
            </div>
          </div>
        </div>

        {booking.cancelled_at && (
          <div className="mb-6 bg-slate-100 p-4 rounded-xl">
            <p className="font-medium text-slate-900">Cancellation Details</p>
            <p className="text-sm text-slate-600 mt-1">
              Cancelled{' '}
              {booking.cancelled_by === 'customer'
                ? 'by you'
                : booking.cancelled_by === 'owner'
                  ? 'by business owner'
                  : 'automatically'}{' '}
              on {new Date(booking.cancelled_at).toLocaleString()}
            </p>
            {booking.cancellation_reason && (
              <p className="text-sm text-slate-600 mt-1">Reason: {booking.cancellation_reason}</p>
            )}
          </div>
        )}

        {canCancel && (
          <div className="mb-6 space-y-3">
            <button
              type="button"
              onClick={handleCancel}
              disabled={cancelling || isCancellationTooLate}
              title={isCancellationTooLate ? ERROR_MESSAGES.CANCELLATION_TOO_LATE : undefined}
              className="w-full bg-red-600 text-white font-semibold py-3 px-6 rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cancelling ? 'Cancelling...' : 'Cancel Booking'}
            </button>
            {isCancellationTooLate && (
              <p className="text-sm text-slate-500">{ERROR_MESSAGES.CANCELLATION_TOO_LATE}</p>
            )}
            {booking.slot && booking.salon && availableSlots.length > 0 && !booking.no_show && (
              <div className="flex justify-center">
                <RescheduleButton
                  bookingId={booking.id}
                  currentSlot={booking.slot}
                  businessId={booking.business_id}
                  availableSlots={availableSlots}
                  onRescheduled={() => {
                    // Refetch booking to get updated slot data after reschedule
                    fetchBooking({ silent: true });
                  }}
                  rescheduledBy="customer"
                />
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-slate-200">
          <Link
            href={ROUTES.CUSTOMER_DASHBOARD}
            className="flex-1 inline-flex items-center justify-center gap-2 text-center bg-slate-100 text-slate-800 font-semibold py-3 px-6 rounded-xl hover:bg-slate-200 transition-all"
          >
            <BookingsIcon className="w-5 h-5" aria-hidden="true" />
            {UI_CUSTOMER.NAV_MY_ACTIVITY}
          </Link>
        </div>
      </div>
    </div>
  );
}
