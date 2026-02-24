'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  API_ROUTES,
  BOOKING_IDEMPOTENCY_HEADER,
  ERROR_MESSAGES,
  PHONE_DIGITS,
  UI_CUSTOMER,
} from '@/config/constants';
import { ROUTES } from '@/lib/utils/navigation';
import { generateUuidV7 } from '@/lib/uuid';
import type { PublicBusiness, Slot } from '@/types';
import { formatDate, formatTime } from '@/lib/utils/string';
import { logError } from '@/lib/utils/error-handler';
import { getCSRFToken } from '@/lib/utils/csrf-client';
import { BookingPageSkeleton } from '@/components/ui/skeleton';

type PublicBookingPageProps = { businessSlug: string };

export default function PublicBookingPage({ businessSlug }: PublicBookingPageProps) {
  const router = useRouter();
  const [business, setBusiness] = useState<PublicBusiness | null>(null);
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
    getCSRFToken().catch(console.error);
  }, []);

  useEffect(() => {
    if (!businessSlug) return;
    let cancelled = false;
    fetch(API_ROUTES.BOOK_BUSINESS(businessSlug), { credentials: 'include' })
      .then((res) => res.json())
      .then((result) => {
        if (cancelled) return;
        if (result?.success && result?.data) setBusiness(result.data);
        else setError(result?.error || ERROR_MESSAGES.SALON_NOT_FOUND);
      })
      .catch((err) => {
        if (!cancelled) {
          logError(err, 'PublicBookingPage');
          setError(ERROR_MESSAGES.LOADING_ERROR);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [businessSlug]);

  useEffect(() => {
    if (!business || !selectedDate) return;
    let cancelled = false;
    fetch(`${API_ROUTES.SLOTS}?salon_id=${business.id}&date=${selectedDate}`, {
      credentials: 'include',
    })
      .then((res) => res.json())
      .then((result) => {
        if (cancelled) return;
        if (result?.success && result?.data) {
          setSlots(result.data);
          if (selectedSlot) {
            const updated = result.data.find((s: Slot) => s.id === selectedSlot.id);
            if (!updated || updated.status !== 'available') {
              setSelectedSlot(null);
              if (updated?.status !== 'available')
                setSlotValidationError(UI_CUSTOMER.SLOT_NO_LONGER_AVAILABLE);
            }
          }
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [business, selectedDate]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  }, []);

  const handleSlotSelect = async (slot: Slot) => {
    if (slot.status === 'booked' || slot.status === 'reserved') {
      setError('This slot is no longer available. Please select another.');
      return;
    }
    setValidatingSlot(true);
    setSlotValidationError(null);
    setError(null);
    try {
      const res = await fetch(`/api/slots/${slot.id}`, { credentials: 'include' });
      const result = await res.json();
      if (result?.success && result?.data?.status === 'available') {
        setSelectedSlot(slot);
      } else {
        setSlotValidationError('This slot was just booked. Please select another.');
        setSelectedSlot(null);
        if (business) {
          const r = await fetch(`${API_ROUTES.SLOTS}?salon_id=${business.id}&date=${selectedDate}`);
          const j = await r.json();
          if (j?.success) setSlots(j.data);
        }
      }
    } catch {
      setSlotValidationError('Unable to verify slot availability. Please try again.');
    } finally {
      setValidatingSlot(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !selectedSlot || !business) return;
    if (!customerName.trim()) {
      setError('Please enter your name');
      return;
    }
    const phoneDigits = customerPhone.replace(/\D/g, '');
    if (!phoneDigits || phoneDigits.length !== PHONE_DIGITS) {
      setError(ERROR_MESSAGES.CUSTOMER_PHONE_INVALID);
      return;
    }
    setSubmitting(true);
    setError(null);
    setSlotValidationError(null);
    try {
      const verifyRes = await fetch(`/api/slots/${selectedSlot.id}`);
      const verifyResult = await verifyRes.json();
      if (!verifyResult?.success || verifyResult?.data?.status !== 'available') {
        setSelectedSlot(null);
        const r = await fetch(`${API_ROUTES.SLOTS}?salon_id=${business.id}&date=${selectedDate}`);
        const j = await r.json();
        if (j?.success) setSlots(j.data);
        throw new Error('This slot is no longer available. Please select another.');
      }
      const csrfToken = await getCSRFToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        [BOOKING_IDEMPOTENCY_HEADER]: generateUuidV7(),
      };
      if (csrfToken) headers['x-csrf-token'] = csrfToken;
      const res = await fetch(API_ROUTES.BOOKINGS, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          salon_id: business.id,
          slot_id: selectedSlot.id,
          customer_name: customerName.trim(),
          customer_phone: phoneDigits,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          setSelectedSlot(null);
          const r = await fetch(`${API_ROUTES.SLOTS}?salon_id=${business.id}&date=${selectedDate}`);
          const j = await r.json();
          if (j?.success) setSlots(j.data);
        }
        throw new Error(result?.error || 'Failed to create booking');
      }
      if (result?.success && result?.data) {
        router.push(ROUTES.BOOKING_STATUS(result.data.booking.booking_id));
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      if (err instanceof Error && err.message.includes('no longer available')) {
        setSelectedSlot(null);
        const r = await fetch(`${API_ROUTES.SLOTS}?salon_id=${business.id}&date=${selectedDate}`);
        const j = await r.json();
        if (j?.success) setSlots(j.data);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const todayStr = today.toISOString().split('T')[0];
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  const minTime = new Date(today.getTime() + 30 * 60000);
  const getFilteredSlots = () => {
    if (!selectedDate || selectedDate !== todayStr) return slots;
    return slots.filter((slot) => {
      const [h, m] = slot.start_time.split(':').map(Number);
      const t = new Date();
      t.setHours(h, m, 0, 0);
      return t >= minTime;
    });
  };

  if (loading) return <BookingPageSkeleton />;
  if (error && !business) {
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
            type="button"
            onClick={() => success.whatsappUrl && window.open(success.whatsappUrl, '_blank')}
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

  return (
    <div className="w-full pb-24 flex flex-col gap-8">
      <div className="w-full">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900 mb-2">{business?.salon_name}</h1>
          <p className="text-slate-600 mb-8">{UI_CUSTOMER.BOOK_PAGE_SUB}</p>

          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              {UI_CUSTOMER.LABEL_SELECT_DATE}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <button
                type="button"
                onClick={() => setSelectedDate(todayStr)}
                className={`px-4 py-2 rounded-xl border-2 transition-colors ${
                  selectedDate === todayStr
                    ? 'border-slate-900 bg-slate-100 text-slate-900'
                    : 'border-slate-300 text-slate-700 hover:border-slate-400'
                }`}
              >
                Today ({formatDate(todayStr)})
              </button>
              <button
                type="button"
                onClick={() => setSelectedDate(tomorrowStr)}
                className={`px-4 py-2 rounded-xl border-2 transition-colors ${
                  selectedDate === tomorrowStr
                    ? 'border-slate-900 bg-slate-100 text-slate-900'
                    : 'border-slate-300 text-slate-700 hover:border-slate-400'
                }`}
              >
                Tomorrow ({formatDate(tomorrowStr)})
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
                    return (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => handleSlotSelect(slot)}
                        disabled={isBooked || validatingSlot || submitting}
                        className={`px-3 sm:px-4 py-2 text-sm sm:text-base rounded-xl border-2 transition-colors ${
                          isBooked
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
                onChange={(e) =>
                  setCustomerPhone(e.target.value.replace(/\D/g, '').slice(0, PHONE_DIGITS))
                }
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
