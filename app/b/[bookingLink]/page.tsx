'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { API_ROUTES, BOOKING_LINK_PREFIX, ERROR_MESSAGES } from '@/config/constants';
import { Salon, Slot } from '@/types';
import { formatDate, formatTime } from '@/lib/utils/string';
import { isTimeInRange } from '@/lib/utils/time';
import { handleApiError, logError } from '@/lib/utils/error-handler';
import { getCSRFToken, clearCSRFToken } from '@/lib/utils/csrf-client';
import { BookingPageSkeleton } from '@/components/ui/skeleton';

export default function BookingPage() {
  const params = useParams();
  const bookingLink = params.bookingLink as string;
  const [salon, setSalon] = useState<Salon | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [success, setSuccess] = useState<{
    bookingId: string;
    whatsappUrl: string;
    bookingStatusUrl?: string;
  } | null>(null);
  const [validatingSlot, setValidatingSlot] = useState(false);
  const [slotValidationError, setSlotValidationError] = useState<string | null>(null);

  useEffect(() => {
    // Pre-fetch CSRF token
    getCSRFToken().catch(console.error);
  }, []);

  useEffect(() => {
    if (!bookingLink) return;

    const fetchSalon = async () => {
      try {
        // Extract token from URL if present (for secure access)
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');

        // Build URL with token if available
        let url = `${API_ROUTES.SALONS}/${bookingLink}`;
        if (token) {
          url += `?token=${encodeURIComponent(token)}`;
        }

        const response = await fetch(url);
        const result = await response.json();

        if (!response.ok) {
          // If token is missing and it's a UUID, try to generate secure URL
          if (
            response.status === 403 &&
            !token &&
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookingLink)
          ) {
            try {
              const { getSecureSalonUrlClient } = await import('@/lib/utils/navigation');
              const secureUrl = await getSecureSalonUrlClient(bookingLink);
              // Redirect to secure URL
              window.location.href = secureUrl;
              return;
            } catch (urlError) {
              console.error('Failed to generate secure URL:', urlError);
            }
          }
          throw new Error(result.error || 'Salon not found');
        }

        if (result.success && result.data) {
          setSalon(result.data);
        }
      } catch (err) {
        logError(err, 'Salon Fetch');
        const friendlyError = err instanceof Error ? err.message : ERROR_MESSAGES.LOADING_ERROR;
        setError(friendlyError);
      } finally {
        setLoading(false);
      }
    };

    fetchSalon();
  }, [bookingLink]);

  useEffect(() => {
    if (!salon || !selectedDate) return;

    const fetchSlots = async () => {
      try {
        const response = await fetch(
          `${API_ROUTES.SLOTS}?salon_id=${salon.id}&date=${selectedDate}`
        );
        const result = await response.json();

        if (result.success && result.data) {
          setSlots(result.data);
          if (selectedSlot) {
            const updatedSlot = result.data.find((s: Slot) => s.id === selectedSlot.id);
            if (!updatedSlot || updatedSlot.status !== 'available') {
              setSelectedSlot(null);
              if (updatedSlot && updatedSlot.status !== 'available') {
                setSlotValidationError(
                  'Your selected slot is no longer available. Please select another.'
                );
              }
            }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load slots');
      }
    };

    fetchSlots();
    // selectedSlot omitted: we only refetch when salon/date changes; selectedSlot is used to clear if no longer available
  }, [salon, selectedDate]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setSelectedDate(today);
  }, []);

  const fetchSlots = async () => {
    if (!salon || !selectedDate) return;
    try {
      const response = await fetch(`${API_ROUTES.SLOTS}?salon_id=${salon.id}&date=${selectedDate}`);
      const result = await response.json();

      if (result.success && result.data) {
        setSlots(result.data);
        if (selectedSlot) {
          const updatedSlot = result.data.find((s: Slot) => s.id === selectedSlot.id);
          if (!updatedSlot || updatedSlot.status !== 'available') {
            setSelectedSlot(null);
            if (updatedSlot && updatedSlot.status !== 'available') {
              setSlotValidationError(
                'Your selected slot is no longer available. Please select another.'
              );
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load slots');
    }
  };

  const handleSlotSelect = async (slot: Slot) => {
    if (slot.status === 'booked' || slot.status === 'reserved') {
      setError('This slot is no longer available. Please select another.');
      return;
    }
    setValidatingSlot(true);
    setSlotValidationError(null);
    setError(null);
    try {
      const response = await fetch(`/api/slots/${slot.id}`);
      const result = await response.json();
      if (result.success && result.data) {
        const currentSlot = result.data;
        if (currentSlot.status === 'available') {
          setSelectedSlot(slot);
        } else {
          setSlotValidationError('This slot was just booked. Please select another.');
          setSelectedSlot(null);
          if (!salon) return;
          const refreshResponse = await fetch(
            `${API_ROUTES.SLOTS}?salon_id=${salon.id}&date=${selectedDate}`
          );
          const refreshResult = await refreshResponse.json();
          if (refreshResult.success) setSlots(refreshResult.data);
        }
      }
    } catch (err) {
      setSlotValidationError('Unable to verify slot availability. Please try again.');
    } finally {
      setValidatingSlot(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (submitting) return;

    if (!selectedSlot || !salon) {
      setError('Please select a time slot');
      return;
    }

    if (!customerName.trim()) {
      setError('Please enter your name');
      return;
    }

    if (!customerPhone.trim()) {
      setError('Please enter your phone number');
      return;
    }

    const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/;
    if (!phoneRegex.test(customerPhone.trim())) {
      setError('Please enter a valid phone number');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSlotValidationError(null);

    try {
      const verifyResponse = await fetch(`${API_ROUTES.SLOTS}/${selectedSlot.id}`);
      const verifyResult = await verifyResponse.json();
      if (!verifyResult.success || verifyResult.data.status !== 'available') {
        setSelectedSlot(null);
        const refreshResponse = await fetch(
          `${API_ROUTES.SLOTS}?salon_id=${salon.id}&date=${selectedDate}`
        );
        const refreshResult = await refreshResponse.json();
        if (refreshResult.success) setSlots(refreshResult.data);
        throw new Error('This slot is no longer available. Please select another.');
      }

      const csrfToken = await getCSRFToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (csrfToken) {
        headers['x-csrf-token'] = csrfToken;
      }

      const response = await fetch(API_ROUTES.BOOKINGS, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          salon_id: salon.id,
          slot_id: selectedSlot.id,
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          setSelectedSlot(null);
          const refreshResponse = await fetch(
            `${API_ROUTES.SLOTS}?salon_id=${salon.id}&date=${selectedDate}`
          );
          const refreshResult = await refreshResponse.json();
          if (refreshResult.success) setSlots(refreshResult.data);
        }
        throw new Error(result.error || 'Failed to create booking');
      }

      if (result.success && result.data) {
        setSuccess({
          bookingId: result.data.booking.booking_id,
          whatsappUrl: result.data.whatsapp_url,
          bookingStatusUrl: result.data.booking_status_url,
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      if (errorMessage.includes('no longer available')) {
        setSelectedSlot(null);
        const refreshResponse = await fetch(
          `${API_ROUTES.SLOTS}?salon_id=${salon.id}&date=${selectedDate}`
        );
        const refreshResult = await refreshResponse.json();
        if (refreshResult.success) setSlots(refreshResult.data);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const openWhatsApp = () => {
    if (success?.whatsappUrl) {
      window.open(success.whatsappUrl, '_blank');
    }
  };

  if (loading) {
    return <BookingPageSkeleton />;
  }

  if (error && !salon) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Salon Not Found</h2>
          <p className="text-gray-600 mb-8">{error}</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Booking Request Sent!</h2>
          <p className="text-gray-600 mb-6">
            Your booking ID is: <strong>{success.bookingId}</strong>
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Click the button below to send your booking request to the salon owner on WhatsApp
          </p>
          <button
            onClick={openWhatsApp}
            className="w-full bg-black text-white font-semibold py-3 px-6 rounded-lg hover:bg-gray-900 transition-colors mb-4"
          >
            Open WhatsApp
          </button>
          {success.bookingStatusUrl && (
            <Link
              href={success.bookingStatusUrl}
              className="block w-full bg-gray-200 text-gray-800 font-semibold py-3 px-6 rounded-lg hover:bg-gray-300 transition-colors mb-4"
            >
              View Booking Status
            </Link>
          )}
          <p className="text-xs text-gray-500">
            The salon owner will confirm your appointment and send you a confirmation message
          </p>
        </div>
      </div>
    );
  }

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const availableSlots = slots.filter((s) => s.status === 'available');
  const bookedSlots = slots.filter((s) => s.status === 'booked');

  return (
    <div className="min-h-screen bg-white py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{salon?.salon_name}</h1>
          <p className="text-gray-600 mb-8">Book your appointment</p>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Date</label>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setSelectedDate(today.toISOString().split('T')[0])}
                className={`px-4 py-2 rounded-lg border-2 transition-colors ${
                  selectedDate === today.toISOString().split('T')[0]
                    ? 'border-black bg-gray-100 text-black'
                    : 'border-gray-300 text-gray-700 hover:border-gray-400'
                }`}
              >
                Today ({formatDate(today.toISOString().split('T')[0])})
              </button>
              <button
                onClick={() => setSelectedDate(tomorrow.toISOString().split('T')[0])}
                className={`px-4 py-2 rounded-lg border-2 transition-colors ${
                  selectedDate === tomorrow.toISOString().split('T')[0]
                    ? 'border-black bg-gray-100 text-black'
                    : 'border-gray-300 text-gray-700 hover:border-gray-400'
                }`}
              >
                Tomorrow ({formatDate(tomorrow.toISOString().split('T')[0])})
              </button>
            </div>
          </div>

          {selectedDate && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Time</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {slots.length === 0 ? (
                  <p className="col-span-full text-gray-500 text-center py-4">
                    No slots available for this date
                  </p>
                ) : (
                  slots.map((slot) => {
                    const isSelected = selectedSlot?.id === slot.id;
                    const isBooked = slot.status === 'booked';
                    // Backend already filters past slots, so we just need to check booked status
                    const isDisabled = isBooked;

                    return (
                      <button
                        key={slot.id}
                        onClick={() => handleSlotSelect(slot)}
                        disabled={isDisabled || validatingSlot || submitting}
                        className={`px-4 py-2 rounded-lg border-2 transition-colors ${
                          isDisabled
                            ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                            : validatingSlot && isSelected
                              ? 'border-yellow-400 bg-yellow-50 text-yellow-800'
                              : isSelected
                                ? 'border-black bg-gray-100 text-black'
                                : 'border-gray-300 text-gray-700 hover:border-gray-400'
                        }`}
                      >
                        {validatingSlot && isSelected ? (
                          <span className="flex items-center gap-2">
                            <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-current"></span>
                            Verifying...
                          </span>
                        ) : (
                          <>
                            {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                            {isBooked && ' (Full)'}
                          </>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="customer_name"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Your Name <span className="text-black">*</span>
              </label>
              <input
                type="text"
                id="customer_name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label
                htmlFor="customer_phone"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Phone Number <span className="text-black">*</span>
              </label>
              <input
                type="tel"
                id="customer_phone"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                placeholder="9876543210"
              />
            </div>

            {(error || slotValidationError) && (
              <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
                {error || slotValidationError}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !selectedSlot || validatingSlot}
              className="w-full bg-black text-white font-semibold py-3 px-6 rounded-lg hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                  Creating Booking...
                </>
              ) : (
                'Send Booking Request'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
