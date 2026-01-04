'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { API_ROUTES } from '@/config/constants';
import { BookingWithDetails } from '@/types';
import { formatDate, formatTime } from '@/lib/utils/string';

export default function AcceptPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [booking, setBooking] = useState<BookingWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ whatsappUrl?: string } | false>(false);

  useEffect(() => {
    if (!id) return;

    const fetchBooking = async () => {
      try {
        const response = await fetch(`${API_ROUTES.BOOKINGS}/${id}`);
        const result = await response.json();

        if (!response.ok) {
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
  }, [id]);

  const handleAccept = async () => {
    if (!id) return;

    setProcessing(true);
    setError(null);

    try {
      const response = await fetch(`${API_ROUTES.BOOKINGS}/${id}/accept`, {
        method: 'POST',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to confirm booking');
      }

      if (result.success && result.data?.whatsapp_url) {
        setSuccess({
          whatsappUrl: result.data.whatsapp_url,
        });
        setTimeout(() => {
          window.open(result.data.whatsapp_url, '_blank');
        }, 300);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (error && !booking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Booking Not Found</h2>
          <p className="text-gray-600 mb-8">{error}</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Booking Accepted!</h2>
          <p className="text-gray-600 mb-6">
            The confirmation message has been opened in WhatsApp. The customer will be notified automatically.
          </p>
          {success.whatsappUrl && (
            <a
              href={success.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block w-full bg-green-500 text-white font-semibold py-3 px-6 rounded-lg hover:bg-green-600 transition-colors mb-4"
            >
              Open WhatsApp Again
            </a>
          )}
          <button
            onClick={() => router.push('/')}
            className="w-full bg-gray-200 text-gray-800 font-semibold py-3 px-6 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Booking Not Found</h2>
          <p className="text-gray-600 mb-8">Unable to load booking details.</p>
        </div>
      </div>
    );
  }

  if (!booking.slot || !booking.salon) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Incomplete Booking Data</h2>
          <p className="text-gray-600 mb-8">
            Booking found but missing slot or salon information. Please contact support.
          </p>
        </div>
      </div>
    );
  }

  const date = formatDate(booking.slot.date);
  const time = `${formatTime(booking.slot.start_time)} - ${formatTime(booking.slot.end_time)}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Confirm Booking</h2>

        <div className="space-y-4 mb-6">
          <div>
            <p className="text-sm text-gray-500">Customer</p>
            <p className="text-lg font-semibold text-gray-900">{booking.customer_name}</p>
          </div>

          <div>
            <p className="text-sm text-gray-500">Phone</p>
            <p className="text-lg font-semibold text-gray-900">{booking.customer_phone}</p>
          </div>

          <div>
            <p className="text-sm text-gray-500">Salon</p>
            <p className="text-lg font-semibold text-gray-900">{booking.salon.salon_name}</p>
          </div>

          <div>
            <p className="text-sm text-gray-500">Date</p>
            <p className="text-lg font-semibold text-gray-900">{date}</p>
          </div>

          <div>
            <p className="text-sm text-gray-500">Time</p>
            <p className="text-lg font-semibold text-gray-900">{time}</p>
          </div>

          <div>
            <p className="text-sm text-gray-500">Booking ID</p>
            <p className="text-lg font-semibold text-gray-900">{booking.booking_id}</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <div className="flex gap-4">
          <button
            onClick={handleAccept}
            disabled={processing || booking.status !== 'pending'}
            className="flex-1 bg-green-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processing ? 'Accepting...' : 'Accept'}
          </button>
          <button
            onClick={() => router.push(`/reject/${id}`)}
            disabled={processing || booking.status !== 'pending'}
            className="flex-1 bg-red-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Not Available
          </button>
        </div>

        {booking.status !== 'pending' && (
          <p className="mt-4 text-sm text-gray-500 text-center">
            This booking is already {booking.status}
          </p>
        )}
      </div>
    </div>
  );
}

