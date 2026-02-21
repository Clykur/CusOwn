'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  API_ROUTES,
  BOOKING_IDEMPOTENCY_HEADER,
  ERROR_MESSAGES,
  PHONE_DIGITS,
  UI_CUSTOMER,
} from '@/config/constants';
import { ROUTES } from '@/lib/utils/navigation';
import { generateUuidV7 } from '@/lib/uuid';
import { Salon, Slot } from '@/types';
import { formatDate, formatTime } from '@/lib/utils/string';
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
                setSlotValidationError(UI_CUSTOMER.SLOT_NO_LONGER_AVAILABLE);
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
              setSlotValidationError(UI_CUSTOMER.SLOT_NO_LONGER_AVAILABLE);
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
      const response = await fetch(`/api/slots/${slot.id}`, { credentials: 'include' });
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

    const phoneDigits = customerPhone.replace(/\D/g, '');
    if (!phoneDigits) {
      setError(ERROR_MESSAGES.CUSTOMER_PHONE_REQUIRED);
      return;
    }
    if (phoneDigits.length !== PHONE_DIGITS) {
      setError(ERROR_MESSAGES.CUSTOMER_PHONE_INVALID);
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
      const idempotencyKey = generateUuidV7();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        [BOOKING_IDEMPOTENCY_HEADER]: idempotencyKey,
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
          customer_phone: phoneDigits,
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
      <div className="w-full">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm text-center">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">
            {ERROR_MESSAGES.SALON_NOT_FOUND}
          </h2>
          <p className="text-slate-600">{error}</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="w-full">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm text-center">
          <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4">
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
          <h2 className="text-xl font-semibold text-slate-900 mb-2">
            {UI_CUSTOMER.BOOKING_SENT_HEADING}
          </h2>
          <p className="text-slate-600 mb-6">
            {UI_CUSTOMER.BOOKING_SENT_ID_LABEL}{' '}
            <strong className="text-slate-900">{success.bookingId}</strong>
          </p>
          <p className="text-sm text-slate-500 mb-6">{UI_CUSTOMER.BOOKING_SENT_WHATSAPP_HINT}</p>
          <button
            onClick={openWhatsApp}
            className="w-full bg-slate-900 text-white font-semibold py-3 px-6 rounded-xl hover:bg-slate-800 transition-colors mb-4"
          >
            {UI_CUSTOMER.CTA_OPEN_WHATSAPP}
          </button>
          {success.bookingId && (
            <Link
              href={ROUTES.BOOKING_STATUS(success.bookingId)}
              className="block w-full bg-slate-100 text-slate-800 font-semibold py-3 px-6 rounded-xl hover:bg-slate-200 transition-colors mb-4"
            >
              {UI_CUSTOMER.CTA_VIEW_BOOKING_STATUS}
            </Link>
          )}
          <p className="text-xs text-slate-500">{UI_CUSTOMER.BOOKING_SENT_CONFIRM_HINT}</p>
        </div>
      </div>
    );
  }

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const getFilteredSlots = () => {
    if (!selectedDate) return slots;

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Only filter if selected date is today
    if (selectedDate !== todayStr) {
      return slots;
    }

    const minTime = new Date(now.getTime() + 30 * 60000); // +30 minutes

    return slots.filter((slot) => {
      const [hours, minutes] = slot.start_time.split(':').map(Number);
      const slotTime = new Date();
      slotTime.setHours(hours, minutes, 0, 0);

      return slotTime >= minTime;
    });
  };
  const availableSlots = slots.filter((s) => s.status === 'available');
  const bookedSlots = slots.filter((s) => s.status === 'booked');

  return (
    <div className="w-full pb-24 flex flex-col gap-8">
      <div className="w-full">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900 mb-2">{salon?.salon_name}</h1>
          <p className="text-slate-600 mb-8">{UI_CUSTOMER.BOOK_PAGE_SUB}</p>

          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              {UI_CUSTOMER.LABEL_SELECT_DATE}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <button
                type="button"
                onClick={() => setSelectedDate(today.toISOString().split('T')[0])}
                className={`px-4 py-2 rounded-xl border-2 transition-colors ${
                  selectedDate === today.toISOString().split('T')[0]
                    ? 'border-slate-900 bg-slate-100 text-slate-900'
                    : 'border-slate-300 text-slate-700 hover:border-slate-400'
                }`}
              >
                Today ({formatDate(today.toISOString().split('T')[0])})
              </button>
              <button
                type="button"
                onClick={() => setSelectedDate(tomorrow.toISOString().split('T')[0])}
                className={`px-4 py-2 rounded-xl border-2 transition-colors ${
                  selectedDate === tomorrow.toISOString().split('T')[0]
                    ? 'border-slate-900 bg-slate-100 text-slate-900'
                    : 'border-slate-300 text-slate-700 hover:border-slate-400'
                }`}
              >
                Tomorrow ({formatDate(tomorrow.toISOString().split('T')[0])})
              </button>
            </div>
          </div>

          {selectedDate && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                {UI_CUSTOMER.LABEL_SELECT_TIME}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
                {slots.length === 0 ? (
                  <p className="col-span-full text-slate-500 text-center py-4">
                    {UI_CUSTOMER.SLOTS_NONE}
                  </p>
                ) : (
                  getFilteredSlots().map((slot) => {
                    const isSelected = selectedSlot?.id === slot.id;
                    const isBooked = slot.status === 'booked';
                    const isDisabled = isBooked;

                    return (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => handleSlotSelect(slot)}
                        disabled={isDisabled || validatingSlot || submitting}
                        className={`px-3 sm:px-4 py-2 text-sm sm:text-base rounded-xl border-2 transition-colors ${
                          isDisabled
                            ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                            : validatingSlot && isSelected
                              ? 'border-amber-400 bg-amber-50 text-amber-800'
                              : isSelected
                                ? 'border-slate-900 bg-slate-100 text-slate-900'
                                : 'border-slate-300 text-slate-700 hover:border-slate-400'
                        }`}
                      >
                        {validatingSlot && isSelected ? (
                          <span className="flex items-center gap-2">
                            <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-current" />
                            {UI_CUSTOMER.SLOT_VERIFYING}
                          </span>
                        ) : (
                          <>
                            {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                            {isBooked && ` (${UI_CUSTOMER.SLOT_FULL})`}
                          </>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            <div>
              <label
                htmlFor="customer_name"
                className="block text-sm font-medium text-slate-700 mb-2"
              >
                {UI_CUSTOMER.LABEL_YOUR_NAME} <span className="text-slate-900">*</span>
              </label>
              <input
                type="text"
                id="customer_name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                required
                className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
                placeholder={UI_CUSTOMER.PLACEHOLDER_NAME}
              />
            </div>

            <div>
              <label
                htmlFor="customer_phone"
                className="block text-sm font-medium text-slate-700 mb-2"
              >
                {UI_CUSTOMER.LABEL_PHONE_NUMBER} <span className="text-slate-900">*</span>
              </label>
              <input
                type="tel"
                id="customer_phone"
                value={customerPhone}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, PHONE_DIGITS);
                  setCustomerPhone(digits);
                }}
                required
                maxLength={PHONE_DIGITS}
                pattern="[0-9]{10}"
                inputMode="numeric"
                autoComplete="tel"
                className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
                placeholder={UI_CUSTOMER.PLACEHOLDER_PHONE}
              />
            </div>

            {(error || slotValidationError) && (
              <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl">
                {error || slotValidationError}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !selectedSlot || validatingSlot}
              className="w-full bg-slate-900 text-white font-semibold py-3 px-6 rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  {UI_CUSTOMER.SUBMIT_BOOKING_LOADING}
                </>
              ) : (
                UI_CUSTOMER.SUBMIT_BOOKING
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
