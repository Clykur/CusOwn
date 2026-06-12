'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  API_ROUTES,
  UI_BOOKING_STATE,
  UI_IDEMPOTENT,
  UI_CONTEXT,
  UI_ERROR_CONTEXT,
  SECURE_LINK_RESPONSE_CODE,
} from '@cusown/config';
import { BookingWithDetails } from '@cusown/shared';
import { formatDate, formatTime } from '@cusown/shared';
import { ROUTES } from '@cusown/shared';
import { getCSRFToken, clearCSRFToken } from '@cusown/shared';
import { AcceptRejectSkeleton } from '@/components/ui/skeleton';
import CheckIcon from '@cusown/shared/icons/check.svg';

export default function AcceptPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params?.id === 'string' ? params.id : '';
  const [booking, setBooking] = useState<BookingWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ whatsappUrl?: string } | false>(false);

  useEffect(() => {
    // Pre-fetch CSRF token
    getCSRFToken().catch(console.error);
  }, []);

  useEffect(() => {
    if (!id) return;

    const fetchBooking = async () => {
      try {
        // Extract token from URL if present
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');

        // Build URL with token if available
        let url = `${API_ROUTES.BOOKINGS}/${id}`;
        if (token) {
          url += `?token=${encodeURIComponent(token)}`;
        }

        const response = await fetch(url);
        const result = await response.json();

        if (!response.ok) {
          if (response.status === 403 && result?.code === SECURE_LINK_RESPONSE_CODE) {
            router.replace('/link-expired');
            return;
          }
          throw new Error(result.error || 'Booking not found');
        }

        if (result.success && result.data) {
          setBooking(result.data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load booking');
      } finally {
        setLoading(false);
      }
    };

    fetchBooking();
  }, [id, router]);

  const handleAccept = async () => {
    if (!id) return;

    setProcessing(true);
    setError(null);

    try {
      const csrfToken = await getCSRFToken();
      const headers: Record<string, string> = {};

      if (csrfToken) {
        headers['x-csrf-token'] = csrfToken;
      }

      // Include token from URL if present
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');

      let url = `${API_ROUTES.BOOKINGS}/${id}/accept`;
      if (token) {
        url += `?token=${encodeURIComponent(token)}`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        if (response.status === 403 && errorData?.code === SECURE_LINK_RESPONSE_CODE) {
          router.replace('/link-expired');
          return;
        }
        throw new Error(errorData.error || `Failed to confirm booking (${response.status})`);
      }

      const result = await response.json();

      if (result.success && result.data) {
        const whatsappUrl = result.data.whatsapp_url;
        setSuccess({ whatsappUrl: whatsappUrl ?? undefined });
        if (whatsappUrl) {
          setTimeout(() => window.open(whatsappUrl, '_blank'), 300);
        }
      } else {
        throw new Error(result.error || 'Failed to confirm booking');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      clearCSRFToken();
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return <AcceptRejectSkeleton />;
  }

  if (error && !booking) {
    return (
      <div className="min-h-screen bg-background-primary flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-zinc-900/40 border border-white/10 rounded-2xl shadow-2xl p-8 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Unable to load</h2>
          <p className="text-zinc-400 mb-8">{UI_ERROR_CONTEXT.ACCEPT_REJECT_PAGE}</p>
          <a
            href={ROUTES.HOME}
            className="inline-block bg-brand-primary text-black font-semibold py-3 px-6 rounded-lg hover:bg-brand-primaryHover transition-colors"
          >
            Go home
          </a>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-background-primary flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-zinc-900/40 border border-white/10 rounded-2xl shadow-2xl p-8 text-center">
          <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <CheckIcon className="w-8 h-8 text-emerald-400" aria-hidden="true" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Booking Accepted!</h2>
          <p className="text-zinc-400 mb-6">
            The confirmation message has been opened in WhatsApp. The customer will be notified
            automatically.
          </p>
          {success.whatsappUrl && (
            <a
              href={success.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block w-full bg-brand-primary text-black font-semibold py-3 px-6 rounded-lg hover:bg-brand-primaryHover transition-colors mb-4"
            >
              Open WhatsApp Again
            </a>
          )}
          <a
            href={ROUTES.OWNER_DASHBOARD_BASE}
            className="block w-full bg-zinc-800 text-zinc-200 border border-white/10 font-semibold py-3 px-6 rounded-lg hover:bg-zinc-700 transition-colors mb-3"
          >
            {UI_CONTEXT.GO_TO_OWNER_DASHBOARD}
          </a>
          <button
            onClick={() => router.push(ROUTES.HOME)}
            className="w-full bg-zinc-900 text-zinc-400 border border-white/5 font-medium py-3 px-6 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-background-primary flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-zinc-900/40 border border-white/10 rounded-2xl shadow-2xl p-8 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Booking Not Found</h2>
          <p className="text-zinc-400 mb-8">Unable to load booking details.</p>
        </div>
      </div>
    );
  }

  if (booking.status === 'cancelled') {
    const isExpired = booking.cancelled_by === 'system';
    return (
      <div className="min-h-screen bg-background-primary flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-zinc-900/40 border border-white/10 rounded-2xl shadow-2xl p-8 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">
            {isExpired ? UI_BOOKING_STATE.EXPIRED : UI_BOOKING_STATE.CANCELLED}
          </h2>
          <p className="text-zinc-400 mb-8">
            {isExpired
              ? 'This request is no longer valid. The customer can book a new slot.'
              : 'This booking was cancelled and can no longer be confirmed.'}
          </p>
        </div>
      </div>
    );
  }

  if (booking.status === 'confirmed') {
    return (
      <div className="min-h-screen bg-background-primary flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-zinc-900/40 border border-white/10 rounded-2xl shadow-2xl p-8 text-center">
          <h2 className="text-2xl font-bold text-white mb-2">Already confirmed</h2>
          <p className="text-zinc-400 mb-6">{UI_IDEMPOTENT.ALREADY_CONFIRMED}</p>
          <button
            onClick={() => router.push(ROUTES.HOME)}
            className="w-full bg-brand-primary text-black font-semibold py-3 px-6 rounded-lg hover:bg-brand-primaryHover transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  if (booking.status === 'rejected') {
    return (
      <div className="min-h-screen bg-background-primary flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-zinc-900/40 border border-white/10 rounded-2xl shadow-2xl p-8 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">{UI_BOOKING_STATE.REJECTED}</h2>
          <p className="text-zinc-400 mb-8">This booking was already declined.</p>
        </div>
      </div>
    );
  }

  if (!booking.slot || !booking.salon) {
    return (
      <div className="min-h-screen bg-background-primary flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-zinc-900/40 border border-white/10 rounded-2xl shadow-2xl p-8 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Incomplete Booking Data</h2>
          <p className="text-zinc-400 mb-8">
            Booking found but missing slot or salon information. Please contact support.
          </p>
        </div>
      </div>
    );
  }

  const date = formatDate(booking.slot.date);
  const time = `${formatTime(booking.slot.start_time)} - ${formatTime(booking.slot.end_time)}`;

  return (
    <div className="min-h-screen bg-background-primary flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-zinc-900/40 border border-white/10 rounded-2xl shadow-2xl p-8">
        <p className="text-sm text-zinc-400 mb-4 pb-4 border-b border-white/10">
          {UI_CONTEXT.SECURE_ACTION_LINK}
        </p>
        <h2 className="text-2xl font-bold text-white mb-6">Confirm Booking</h2>

        <div className="space-y-4 mb-6">
          <div>
            <p className="text-sm text-zinc-500">Customer</p>
            <p className="text-lg font-semibold text-white">{booking.customer_name}</p>
          </div>

          <div>
            <p className="text-sm text-zinc-500">Phone</p>
            <p className="text-lg font-semibold text-white">{booking.customer_phone}</p>
          </div>

          <div>
            <p className="text-sm text-zinc-500">Salon</p>
            <p className="text-lg font-semibold text-white">{booking.salon.salon_name}</p>
          </div>

          <div>
            <p className="text-sm text-zinc-500">Date</p>
            <p className="text-lg font-semibold text-white">{date}</p>
          </div>

          <div>
            <p className="text-sm text-zinc-500">Time</p>
            <p className="text-lg font-semibold text-white">{time}</p>
          </div>

          <div>
            <p className="text-sm text-zinc-500">Booking ID</p>
            <p className="text-lg font-semibold text-white">{booking.booking_id}</p>
          </div>
        </div>

        {error && (
          <div className="bg-state-error/10 border border-state-error/20 text-state-error px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <div className="flex gap-4">
          <button
            onClick={handleAccept}
            disabled={processing || booking.status !== 'pending'}
            aria-busy={processing}
            className="flex-1 bg-brand-primary text-black font-semibold py-3 px-6 rounded-lg hover:bg-brand-primaryHover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processing ? 'Accepting...' : 'Accept'}
          </button>
          <button
            onClick={() => router.push(ROUTES.REJECT(id))}
            disabled={processing || booking.status !== 'pending'}
            className="flex-1 bg-zinc-800 text-zinc-200 border border-white/10 font-semibold py-3 px-6 rounded-lg hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Not Available
          </button>
        </div>

        {booking.status !== 'pending' && (
          <p className="mt-4 text-sm text-zinc-500 text-center">
            This booking is already {booking.status}
          </p>
        )}
      </div>
    </div>
  );
}
