'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
import CheckIcon from '@/src/icons/check.svg';

const PENDING_BOOKING_KEY = 'pendingBooking';

/** Get local today string YYYY-MM-DD without timezone offset issues. */
function getLocalTodayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** Returns true if the selected date is today (local). */
function isToday(dateStr: string): boolean {
  return dateStr === getLocalTodayStr();
}

/** Returns true if business is currently closed (past closing hour today). */
function isAfterBusinessHours(closeHour: number): boolean {
  const now = new Date();
  return now.getHours() >= closeHour;
}

/**
 * Filter slots based on the business's actual opening/closing hours.
 * - Remove slots outside the business's configured hours
 * - For today: remove slots whose start_time has already passed
 * - For today after closing: return empty (all expired)
 * - For future dates: show full working-hour slots
 */
function filterSlotsByBusinessHours(
  slots: Slot[],
  selectedDate: string,
  openHour: number,
  closeHour: number
): Slot[] {
  // 1. Always filter out slots outside the business's actual hours
  let filtered = slots.filter((slot) => {
    const [startH] = slot.start_time.split(':').map(Number);
    const [endH, endM] = slot.end_time.split(':').map(Number);
    const endMinutes = endH * 60 + endM;
    return startH >= openHour && endMinutes <= closeHour * 60;
  });

  // 2. For today only, apply time-based expiry
  if (isToday(selectedDate)) {
    if (isAfterBusinessHours(closeHour)) return [];

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    filtered = filtered.filter((slot) => {
      const [h, m] = slot.start_time.split(':').map(Number);
      return h * 60 + m > currentMinutes;
    });
  }

  return filtered;
}

type PendingBookingData = {
  businessSlug: string;
  selectedSlotId: string;
  selectedDate: string;
  customerName: string;
  customerPhone: string;
  savedAt: number;
};

function savePendingBooking(data: PendingBookingData): void {
  try {
    localStorage.setItem(PENDING_BOOKING_KEY, JSON.stringify(data));
  } catch {
    // localStorage may be unavailable (private browsing, quota)
  }
}

function loadPendingBooking(): PendingBookingData | null {
  try {
    const raw = localStorage.getItem(PENDING_BOOKING_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as PendingBookingData;
    // Expire after 30 minutes
    if (Date.now() - data.savedAt > 30 * 60 * 1000) {
      localStorage.removeItem(PENDING_BOOKING_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function clearPendingBooking(): void {
  try {
    localStorage.removeItem(PENDING_BOOKING_KEY);
  } catch {
    // ignore
  }
}

type PublicBookingPageProps = { businessSlug: string };

export default function PublicBookingPage({ businessSlug }: PublicBookingPageProps) {
  const router = useRouter();
  const [business, setBusiness] = useState<PublicBusiness | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [closedMessage, setClosedMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(getLocalTodayStr());
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [success, setSuccess] = useState<{
    bookingId: string;
    whatsappUrl: string;
    bookingStatusUrl?: string;
  } | null>(null);
  const [validatingSlot, setValidatingSlot] = useState(false);
  const [slotValidationError, setSlotValidationError] = useState<string | null>(null);
  const [restoredFromPending, setRestoredFromPending] = useState(false);
  const midnightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slotRefreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Counter to force re-render when time changes (minute tick / midnight)
  const [, setTimeTick] = useState(0);

  useEffect(() => {
    getCSRFToken().catch(console.error);
  }, []);

  // Midnight reset: when the day rolls over, update the date and re-render
  useEffect(() => {
    const scheduleNextMidnight = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 1, 0); // 1 second past midnight
      const msUntilMidnight = tomorrow.getTime() - now.getTime();

      midnightTimerRef.current = setTimeout(() => {
        // Reset to new today
        setSelectedDate(getLocalTodayStr());
        setSelectedSlot(null);
        setTimeTick((t) => t + 1);
        // Schedule next midnight
        scheduleNextMidnight();
      }, msUntilMidnight);
    };

    scheduleNextMidnight();
    return () => {
      if (midnightTimerRef.current) clearTimeout(midnightTimerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-filter slots every minute for today so expired slots disappear without hard refresh
  useEffect(() => {
    if (!isToday(selectedDate)) {
      if (slotRefreshTimerRef.current) clearInterval(slotRefreshTimerRef.current);
      return;
    }
    slotRefreshTimerRef.current = setInterval(() => {
      setTimeTick((t) => t + 1);
      // If selected slot is now expired, deselect it
      if (selectedSlot) {
        const now = new Date();
        const [h, m] = selectedSlot.start_time.split(':').map(Number);
        const closeH = business?.closing_time
          ? parseInt(business.closing_time.split(':')[0], 10)
          : 24;
        if (h * 60 + m <= now.getHours() * 60 + now.getMinutes() || isAfterBusinessHours(closeH)) {
          setSelectedSlot(null);
        }
      }
    }, 60_000); // every minute
    return () => {
      if (slotRefreshTimerRef.current) clearInterval(slotRefreshTimerRef.current);
    };
  }, [selectedDate, selectedSlot, business?.closing_time]);

  // Restore form data from localStorage after login redirect
  const restorePendingBooking = useCallback(
    (loadedSlots: Slot[]) => {
      const pending = loadPendingBooking();
      if (!pending || pending.businessSlug !== businessSlug) return;

      if (pending.customerName) setCustomerName(pending.customerName);
      if (pending.customerPhone) setCustomerPhone(pending.customerPhone);
      if (pending.selectedDate) setSelectedDate(pending.selectedDate);

      if (pending.selectedSlotId && loadedSlots.length > 0) {
        const matchedSlot = loadedSlots.find(
          (s) => s.id === pending.selectedSlotId && s.status === 'available'
        );
        if (matchedSlot) setSelectedSlot(matchedSlot);
      }

      setRestoredFromPending(true);
    },
    [businessSlug]
  );

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

  // Set initial date — prefer pending booking date if available
  useEffect(() => {
    const pending = loadPendingBooking();
    if (pending?.businessSlug === businessSlug && pending.selectedDate) {
      setSelectedDate(pending.selectedDate);
    } else {
      setSelectedDate(getLocalTodayStr());
    }
  }, [businessSlug]);

  useEffect(() => {
    if (!business || !selectedDate) return;
    let cancelled = false;
    setClosedMessage(null);
    fetch(`${API_ROUTES.SLOTS}?salon_id=${business.id}&date=${selectedDate}`, {
      credentials: 'include',
    })
      .then((res) => res.json())
      .then((result) => {
        if (cancelled) return;
        if (result?.success && result?.data) {
          // Detect server-side closed / holiday state
          if (result.data.closed) {
            setClosedMessage(result.data.message || 'Shop is closed on this day.');
            setSlots([]);
            return;
          }
          setClosedMessage(null);
          const loadedSlots: Slot[] = Array.isArray(result.data)
            ? result.data
            : (result.data.slots ?? []);
          setSlots(loadedSlots);

          // Restore from pending booking if returning from login
          if (!restoredFromPending) {
            restorePendingBooking(loadedSlots);
          }

          if (selectedSlot) {
            const updated = loadedSlots.find((s: Slot) => s.id === selectedSlot.id);
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
  }, [business, selectedDate, restoredFromPending, restorePendingBooking]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSlotSelect = async (slot: Slot) => {
    if (slot.status === 'booked' || slot.status === 'reserved') {
      setError('This slot is no longer available. Please select another.');
      return;
    }
    setValidatingSlot(true);
    setSlotValidationError(null);
    setError(null);
    try {
      const res = await fetch(`/api/slots/${slot.id}`, {
        credentials: 'include',
      });
      const result = await res.json();
      if (result?.success && result?.data?.status === 'available') {
        setSelectedSlot(slot);
      } else {
        setSlotValidationError('This slot was just booked. Please select another.');
        setSelectedSlot(null);
        if (business) {
          const r = await fetch(`${API_ROUTES.SLOTS}?salon_id=${business.id}&date=${selectedDate}`);
          const j = await r.json();
          if (j?.success) setSlots(Array.isArray(j.data) ? j.data : (j.data?.slots ?? []));
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
      // Check authentication via server endpoint (httpOnly cookies aren't visible to client JS)
      const sessionRes = await fetch('/api/auth/session', {
        credentials: 'include',
      });
      const sessionData = await sessionRes.json();
      const isAuthenticated = sessionData?.success && sessionData?.data?.user;

      if (!isAuthenticated) {
        // Save form data to localStorage so it persists across login redirect
        savePendingBooking({
          businessSlug,
          selectedSlotId: selectedSlot.id,
          selectedDate,
          customerName: customerName.trim(),
          customerPhone: phoneDigits,
          savedAt: Date.now(),
        });

        // Redirect to login with redirect back to this booking page
        const bookingPath = `/book/${businessSlug}`;
        router.push(ROUTES.AUTH_LOGIN(bookingPath) + '&role=customer');
        return;
      }

      // User is authenticated — proceed with booking creation
      const verifyRes = await fetch(`/api/slots/${selectedSlot.id}`);
      const verifyResult = await verifyRes.json();
      if (!verifyResult?.success || verifyResult?.data?.status !== 'available') {
        setSelectedSlot(null);
        const r = await fetch(`${API_ROUTES.SLOTS}?salon_id=${business.id}&date=${selectedDate}`);
        const j = await r.json();
        if (j?.success) setSlots(Array.isArray(j.data) ? j.data : (j.data?.slots ?? []));
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
          if (j?.success) setSlots(Array.isArray(j.data) ? j.data : (j.data?.slots ?? []));
        }
        throw new Error(result?.error || 'Failed to create booking');
      }
      if (result?.success && result?.data) {
        // Clear pending booking data after successful creation
        clearPendingBooking();
        router.push(ROUTES.BOOKING_STATUS(result.data.booking.booking_id));
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      if (err instanceof Error && err.message.includes('no longer available')) {
        setSelectedSlot(null);
        const r = await fetch(`${API_ROUTES.SLOTS}?salon_id=${business.id}&date=${selectedDate}`);
        const j = await r.json();
        if (j?.success) setSlots(Array.isArray(j.data) ? j.data : (j.data?.slots ?? []));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const todayStr = getLocalTodayStr();
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowStr = `${tomorrowDate.getFullYear()}-${String(tomorrowDate.getMonth() + 1).padStart(2, '0')}-${String(tomorrowDate.getDate()).padStart(2, '0')}`;

  // Parse business opening/closing hours for dynamic filtering
  const businessOpenHour = business?.opening_time
    ? parseInt(business.opening_time.split(':')[0], 10)
    : 0;
  const businessCloseHour = business?.closing_time
    ? parseInt(business.closing_time.split(':')[0], 10)
    : 24;

  // Business-hours aware slot filtering
  const filteredSlots = filterSlotsByBusinessHours(
    slots,
    selectedDate,
    businessOpenHour,
    businessCloseHour
  );
  const isTodayClosed = isToday(selectedDate) && isAfterBusinessHours(businessCloseHour);

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
            <CheckIcon className="w-8 h-8 text-white" aria-hidden="true" />
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
                {closedMessage ? (
                  <div className="col-span-full text-center py-6">
                    <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-sm font-medium">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 flex-shrink-0"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                      {closedMessage}
                    </div>
                  </div>
                ) : isTodayClosed ? (
                  <p className="col-span-full text-slate-500 text-center py-4">
                    No slots available for today. The shop is closed after{' '}
                    {business?.closing_time ? formatTime(business.closing_time) : 'closing time'}.
                    Please select tomorrow.
                  </p>
                ) : filteredSlots.length === 0 ? (
                  <p className="col-span-full text-slate-500 text-center py-4">
                    {UI_CUSTOMER.SLOTS_NONE}
                  </p>
                ) : (
                  filteredSlots.map((slot) => {
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
