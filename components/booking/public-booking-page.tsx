'use client';

import { useEffect, useCallback, useRef, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  API_ROUTES,
  BOOKING_IDEMPOTENCY_HEADER,
  ERROR_MESSAGES,
  PHONE_DIGITS,
  UI_CUSTOMER,
} from '@/config/constants';
import { ROUTES } from '@/lib/utils/navigation';
import { generateUuidV7 } from '@/lib/uuid';
import type { Slot } from '@/types';
import { logError } from '@/lib/utils/error-handler';
import { getCSRFToken } from '@/lib/utils/csrf-client';
import { BookingPageSkeleton, SlotGridSkeleton } from '@/components/ui/skeleton';
import {
  getLocalTodayStr,
  isToday,
  isAfterBusinessHours,
  filterSlotsByBusinessHours,
  savePendingBooking,
  loadPendingBooking,
  clearPendingBooking,
  getInitialRebookData,
} from './booking-utils';
import { dedupFetch, cancelRequests, cancelDebounce } from '@/lib/utils/fetch-dedup';
import { useBookingFlowStore, selectAvailableSlots } from '@/lib/store';

import SlotSelectionGrid from './slot-selection-grid';
import CustomerBookingForm from './customer-booking-form';
import BookingSuccessView from './booking-success-view';

const CalendarGrid = dynamic(() => import('@/components/booking/calendar-grid'), {
  loading: () => (
    <div className="grid grid-cols-7 gap-1 mb-4" aria-busy="true">
      {Array.from({ length: 14 }).map((_, i) => (
        <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />
      ))}
    </div>
  ),
});

import { useSlotUpdates } from '@/lib/realtime/use-slot-updates';
import type { Salon, PublicBusiness } from '@/types';
import Breadcrumb from '@/components/ui/breadcrumb';

type PublicBookingPageProps = {
  businessSlug: string;
  initialBusiness?: Salon | null;
  initialSlots?: Slot[];
  initialClosedDates?: string[];
  initialClosedMessage?: string | null;
  initialDate?: string;
};

function toPublicBusiness(salon: Salon): PublicBusiness {
  return {
    id: salon.id,
    salon_name: salon.salon_name,
    opening_time: salon.opening_time,
    closing_time: salon.closing_time,
    slot_duration: salon.slot_duration,
    booking_link: salon.booking_link,
    address: salon.address ?? null,
    location: salon.location ?? null,
  };
}

export default function PublicBookingPage({
  businessSlug,
  initialBusiness,
  initialSlots,
  initialClosedDates,
  initialClosedMessage,
  initialDate,
}: PublicBookingPageProps) {
  const router = useRouter();
  const rebookAppliedRef = useRef(false);
  const businessFetchedRef = useRef(!!initialBusiness);

  const business = useBookingFlowStore((state) => state.business);
  const setBusiness = useBookingFlowStore((state) => state.setBusiness);
  const setBusinessSlug = useBookingFlowStore((state) => state.setBusinessSlug);
  const selectedDate = useBookingFlowStore((state) => state.selectedDate);
  const setSelectedDate = useBookingFlowStore((state) => state.setSelectedDate);
  const selectedSlot = useBookingFlowStore((state) => state.selectedSlot);
  const setSelectedSlot = useBookingFlowStore((state) => state.setSelectedSlot);
  const slots = useBookingFlowStore((state) => state.slots);
  const setSlots = useBookingFlowStore((state) => state.setSlots);
  const slotCache = useBookingFlowStore((state) => state.slotCache);
  const cacheSlots = useBookingFlowStore((state) => state.cacheSlots);
  const closedDates = useBookingFlowStore((state) => state.closedDates);
  const addClosedDate = useBookingFlowStore((state) => state.addClosedDate);
  const addClosedDates = useBookingFlowStore((state) => state.addClosedDates);
  const removeClosedDate = useBookingFlowStore((state) => state.removeClosedDate);
  const closedMessage = useBookingFlowStore((state) => state.closedMessage);
  const setClosedMessage = useBookingFlowStore((state) => state.setClosedMessage);
  const customerName = useBookingFlowStore((state) => state.customerName);
  const setCustomerName = useBookingFlowStore((state) => state.setCustomerName);
  const customerPhone = useBookingFlowStore((state) => state.customerPhone);
  const setCustomerPhone = useBookingFlowStore((state) => state.setCustomerPhone);
  const isLoading = useBookingFlowStore((state) => state.isLoading);
  const setIsLoading = useBookingFlowStore((state) => state.setIsLoading);
  const dateLoading = useBookingFlowStore((state) => state.dateLoading);
  const setDateLoading = useBookingFlowStore((state) => state.setDateLoading);
  const validatingSlot = useBookingFlowStore((state) => state.validatingSlot);
  const setValidatingSlot = useBookingFlowStore((state) => state.setValidatingSlot);
  const submitting = useBookingFlowStore((state) => state.submitting);
  const setSubmitting = useBookingFlowStore((state) => state.setSubmitting);
  const error = useBookingFlowStore((state) => state.error);
  const setError = useBookingFlowStore((state) => state.setError);
  const slotValidationError = useBookingFlowStore((state) => state.slotValidationError);
  const setSlotValidationError = useBookingFlowStore((state) => state.setSlotValidationError);
  const success = useBookingFlowStore((state) => state.success);
  const setSuccess = useBookingFlowStore((state) => state.setSuccess);
  const reset = useBookingFlowStore((state) => state.reset);

  const midnightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slotRefreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [, setTimeTick] = useState(0);
  const restoredFromPendingRef = useRef(false);
  const [services, setServices] = useState<{ id: string; name: string }[]>([]);

  const searchParams = useSearchParams();
  const serviceId = searchParams?.get('serviceId') ?? null;

  // ── Multi-select: array instead of single string ──────────────────────────
  const [selectedServices, setSelectedServices] = useState<string[]>([]);

  const toggleService = useCallback((id: string) => {
    setSelectedServices((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }, []);

  useEffect(() => {
    if (!business?.id) return;

    const fetchServices = async () => {
      try {
        const res = await fetch(`/api/owner/services?businessId=${business.id}`);
        const data = await res.json();

        if (data.success) {
          setServices(data.data);
          if (serviceId && data.data.some((s: any) => s.id === serviceId)) {
            setSelectedServices([serviceId]);
          }
        } else {
          console.error('Services API error:', data);
        }
      } catch (err) {
        console.error('Error fetching services:', err);
      }
    };

    fetchServices();
  }, [business?.id, businessSlug, serviceId]);

  useEffect(() => {
    if (serviceId && services.length > 0 && !selectedServices.includes(serviceId)) {
      const serviceExists = services.some((s) => s.id === serviceId);
      if (serviceExists) {
        toggleService(serviceId);
      }
    }
  }, [serviceId, services, selectedServices.length, toggleService, selectedServices]);

  // Initialize from server-side data for instant display
  const initialDataAppliedRef = useRef(false);
  useEffect(() => {
    if (initialDataAppliedRef.current) return;
    initialDataAppliedRef.current = true;

    // Apply server-fetched business data immediately
    if (initialBusiness) {
      setBusiness(toPublicBusiness(initialBusiness));
      setIsLoading(false);
    }

    // Apply server-fetched slots for today
    if (initialSlots && initialSlots.length > 0 && initialDate) {
      setSlots(initialSlots);
      cacheSlots(initialDate, initialSlots);
      setDateLoading(false);
    }

    // Apply server-fetched closed dates
    if (initialClosedDates && initialClosedDates.length > 0) {
      addClosedDates(initialClosedDates);
    }

    // Apply server-fetched closed message
    if (initialClosedMessage) {
      setClosedMessage(initialClosedMessage);
      setDateLoading(false);
    }

    // Set initial date from server
    if (initialDate) {
      setSelectedDate(initialDate);
    }
  }, [
    initialBusiness,
    initialSlots,
    initialClosedDates,
    initialClosedMessage,
    initialDate,
    setBusiness,
    setIsLoading,
    setSlots,
    cacheSlots,
    addClosedDates,
    setClosedMessage,
    setDateLoading,
    setSelectedDate,
  ]);

  useEffect(() => {
    getCSRFToken().catch(console.error);
    setBusinessSlug(businessSlug);

    const initialRebook = getInitialRebookData();
    if (initialRebook.applied) {
      rebookAppliedRef.current = true;
      if (initialRebook.name) setCustomerName(initialRebook.name);
      if (initialRebook.phone) setCustomerPhone(initialRebook.phone);
    }

    return () => {
      reset();
    };
  }, [businessSlug, setBusinessSlug, setCustomerName, setCustomerPhone, reset]);

  const selectedSlotRef = useRef<Slot | null>(selectedSlot);
  selectedSlotRef.current = selectedSlot;

  // Use ref to avoid recreating callback on every slots change (prevents infinite loop)
  const slotsRef = useRef<Slot[]>(slots);
  slotsRef.current = slots;

  const handleRealtimeSlotsUpdate = useCallback(
    (nextSlots: Slot[]) => {
      const currentSlots = slotsRef.current;
      const currentById = new Map(currentSlots.map((s) => [s.id, s]));
      let hasChanges = false;

      for (const slot of nextSlots) {
        const existing = currentById.get(slot.id);
        if (
          !existing ||
          existing.status !== slot.status ||
          existing.updated_at !== slot.updated_at
        ) {
          hasChanges = true;
          break;
        }
      }

      if (!hasChanges && nextSlots.length === currentSlots.length) return;

      setSlots(nextSlots);
      cacheSlots(selectedDate, nextSlots);
    },
    [selectedDate, setSlots, cacheSlots]
  );

  const handleSlotStatusChange = useCallback(
    (slotId: string, updatedSlot: Slot) => {
      if (submitting) return; //ignore during booking

      const currentSelectedSlot = selectedSlotRef.current;
      if (currentSelectedSlot && currentSelectedSlot.id === slotId) {
        if (updatedSlot.status !== 'available') {
          setSelectedSlot(null);
          setSlotValidationError(UI_CUSTOMER.SLOT_NO_LONGER_AVAILABLE);
        }
      }
    },
    [submitting, setSelectedSlot, setSlotValidationError]
  );

  useSlotUpdates({
    businessId: business?.id ?? null,
    date: selectedDate,
    slots,
    onSlotsUpdate: handleRealtimeSlotsUpdate,
    onSlotChange: handleSlotStatusChange,
    enabled: !!business && !!selectedDate && !success,
    skipInitialRefetch: slots.length > 0,
  });

  useEffect(() => {
    const scheduleNextMidnight = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 1, 0);
      const msUntilMidnight = tomorrow.getTime() - now.getTime();

      midnightTimerRef.current = setTimeout(() => {
        setSelectedDate(getLocalTodayStr());
        setSelectedSlot(null);
        setTimeTick((t) => t + 1);
        scheduleNextMidnight();
      }, msUntilMidnight);
    };

    scheduleNextMidnight();
    return () => {
      if (midnightTimerRef.current) clearTimeout(midnightTimerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isToday(selectedDate)) {
      if (slotRefreshTimerRef.current) clearInterval(slotRefreshTimerRef.current);
      return;
    }
    slotRefreshTimerRef.current = setInterval(() => {
      setTimeTick((t) => t + 1);
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
    }, 60_000);
    return () => {
      if (slotRefreshTimerRef.current) clearInterval(slotRefreshTimerRef.current);
    };
  }, [selectedDate, selectedSlot, business?.closing_time, setSelectedSlot, setTimeTick]);

  const restorePendingBooking = useCallback(
    (loadedSlots: Slot[]) => {
      const pending = loadPendingBooking();
      if (!pending || pending.businessSlug !== businessSlug) {
        if (rebookAppliedRef.current) {
          restoredFromPendingRef.current = true;
        }
        return;
      }

      if (rebookAppliedRef.current) {
        if (pending.selectedDate) setSelectedDate(pending.selectedDate);
        if (pending.selectedSlotId && loadedSlots.length > 0) {
          const matchedSlot = loadedSlots.find(
            (s) => s.id === pending.selectedSlotId && s.status === 'available'
          );
          if (matchedSlot) setSelectedSlot(matchedSlot);
        }
        restoredFromPendingRef.current = true;
        return;
      }

      if (pending.customerName) setCustomerName(pending.customerName);
      if (pending.customerPhone) setCustomerPhone(pending.customerPhone);
      if (pending.selectedDate) setSelectedDate(pending.selectedDate);
      if (pending.selectedSlotId && loadedSlots.length > 0) {
        const matchedSlot = loadedSlots.find(
          (s) => s.id === pending.selectedSlotId && s.status === 'available'
        );
        if (matchedSlot) setSelectedSlot(matchedSlot);
      }
      restoredFromPendingRef.current = true;
    },
    [businessSlug, setSelectedDate, setSelectedSlot, setCustomerName, setCustomerPhone]
  );

  useEffect(() => {
    if (!businessSlug) return;
    // Skip client fetch if server already provided business data
    if (businessFetchedRef.current) return;
    businessFetchedRef.current = true;

    let cancelled = false;
    fetch(`/api/salons/${businessSlug}`, { credentials: 'include' })
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
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [businessSlug, setBusiness, setError, setIsLoading]);

  // Track if downtime was already fetched from server
  const downtimeFetchedRef = useRef(!!(initialClosedDates && initialClosedDates.length > 0));
  useEffect(() => {
    if (!business?.id) return;
    // Skip client fetch if server already provided downtime data
    if (downtimeFetchedRef.current) return;
    downtimeFetchedRef.current = true;

    let cancelled = false;
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    const lastDayCur = new Date(year, month + 1, 0).getDate();
    const lastDayNext = new Date(nextYear, nextMonth + 1, 0).getDate();
    const rangeCur = Array.from(
      { length: lastDayCur },
      (_, i) => `${year}-${String(month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`
    );
    const rangeNext = Array.from(
      { length: lastDayNext },
      (_, i) =>
        `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`
    );
    const visibleDates = new Set([...rangeCur, ...rangeNext]);

    Promise.all([
      fetch(`/api/businesses/${business.id}/downtime/closures`, { credentials: 'include' }).then(
        (r) => r.json()
      ),
      fetch(`/api/businesses/${business.id}/downtime/holidays`, { credentials: 'include' }).then(
        (r) => r.json()
      ),
    ])
      .then(([closuresRes, holidaysRes]) => {
        if (cancelled) return;
        const closureList = closuresRes?.success ? (closuresRes.data ?? []) : [];
        const holidayList = holidaysRes?.success ? (holidaysRes.data ?? []) : [];
        const closedSet = new Set<string>();
        holidayList.forEach((h: { holiday_date: string }) => {
          if (visibleDates.has(h.holiday_date)) closedSet.add(h.holiday_date);
        });
        closureList.forEach((c: { start_date: string; end_date: string }) => {
          const start = new Date(c.start_date);
          const end = new Date(c.end_date);
          const walk = new Date(start);
          while (walk <= end) {
            const y = walk.getFullYear();
            const m = walk.getMonth();
            const day = walk.getDate();
            const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            if (visibleDates.has(dateStr)) closedSet.add(dateStr);
            walk.setDate(walk.getDate() + 1);
          }
        });
        addClosedDates(Array.from(closedSet));
      })
      .catch(() => {
        if (!cancelled) {
          // Non-fatal: calendar still works, closed dates added on first click
        }
      });
    return () => {
      cancelled = true;
    };
  }, [business?.id, addClosedDates]);

  useEffect(() => {
    if (rebookAppliedRef.current) return;
    // Skip if initialDate was already set from server
    if (initialDate && selectedDate === initialDate) return;
    const pending = loadPendingBooking();
    if (pending?.businessSlug === businessSlug && pending.selectedDate) {
      setSelectedDate(pending.selectedDate);
    } else if (!initialDate) {
      setSelectedDate(getLocalTodayStr());
    }
  }, [businessSlug, setSelectedDate, initialDate, selectedDate]);

  // Track if initial slots have been applied to skip redundant fetch
  const initialSlotsFetchedRef = useRef(false);
  useEffect(() => {
    if (!business || !selectedDate) return;
    let cancelled = false;
    let loadingTimerId: ReturnType<typeof setTimeout> | null = null;

    // Use cached data immediately if available (instant UI response)
    const cached = slotCache.get(selectedDate);
    if (cached) {
      setSlots(cached);
      setDateLoading(false);
      // Skip fetch if this is the initial date with server-provided data
      if (
        selectedDate === initialDate &&
        !initialSlotsFetchedRef.current &&
        (initialSlots?.length || initialClosedMessage)
      ) {
        initialSlotsFetchedRef.current = true;
        return;
      }
    } else {
      setDateLoading(true);
    }

    setClosedMessage(null);
    cancelRequests(`slots:${business.id}`);

    // Service-aware: include selected services
    const serviceIdsParam =
      selectedServices.length > 0 ? `serviceIds=${selectedServices.join(',')}` : '';
    const fetchUrl = `${API_ROUTES.SLOTS}?salon_id=${business.id}&date=${selectedDate}${serviceIdsParam ? `&${serviceIdsParam}` : ''}`;
    dedupFetch(fetchUrl, {
      credentials: 'include',
      dedupKey: `slots:${business.id}:${selectedDate}:${serviceIdsParam || 'none'}`,
      cancelPrevious: true,
    })
      .then((res) => res.json())
      .then((result) => {
        if (cancelled) return;
        if (result?.success && result?.data) {
          if (result.data.closed) {
            setClosedMessage(result.data.message || 'Shop is closed on this day.');
            setSlots([]);
            addClosedDate(selectedDate);
            cacheSlots(selectedDate, []);
            setDateLoading(false);
            return;
          }
          setClosedMessage(null);
          const loadedSlots: Slot[] = Array.isArray(result.data)
            ? result.data
            : (result.data.slots ?? []);
          setSlots(loadedSlots);
          cacheSlots(selectedDate, loadedSlots);
          removeClosedDate(selectedDate);

          if (!rebookAppliedRef.current) {
            const raw = sessionStorage.getItem('rebookData');
            if (raw) {
              try {
                const rebookData = JSON.parse(raw);
                if (rebookData.name || rebookData.phone) {
                  rebookAppliedRef.current = true;
                  if (rebookData.name) setCustomerName(rebookData.name);
                  if (rebookData.phone) setCustomerPhone(rebookData.phone);
                }
              } catch {
                // Ignore
              } finally {
                sessionStorage.removeItem('rebookData');
              }
            }
          }

          if (!restoredFromPendingRef.current && !rebookAppliedRef.current) {
            restorePendingBooking(loadedSlots);
          } else if (rebookAppliedRef.current && !restoredFromPendingRef.current) {
            restoredFromPendingRef.current = true;
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
        setDateLoading(false);
      })
      .catch((err) => {
        // Silently ignore aborted/debounced requests - this is expected during rapid interactions
        if ((err as Error)?.name === 'AbortError') return;
        // Only log unexpected errors
        if (!cancelled) {
          console.error('[PublicBookingPage] Failed to fetch slots:', err);
          setDateLoading(false);
        }
      });
    return () => {
      cancelled = true;
      // Clear loading timer
      if (loadingTimerId) clearTimeout(loadingTimerId);
      // Cancel any pending debounced request for this date
      if (business?.id) {
        cancelDebounce(`slots:${business.id}:${selectedDate}`);
      }
    };
  }, [
    business,
    selectedDate,
    restorePendingBooking,
    slotCache,
    setSlots,
    cacheSlots,
    addClosedDate,
    removeClosedDate,
    setClosedMessage,
    setDateLoading,
    setCustomerName,
    setCustomerPhone,
    setSelectedSlot,
    setSlotValidationError,
    selectedSlot,
    initialDate,
    initialSlots,
    initialClosedMessage,
    selectedServices,
  ]);

  const refetchSlots = useCallback(async () => {
    if (!business) return;
    try {
      const refetchSvc =
        selectedServices.length > 0 ? `serviceIds=${selectedServices.join(',')}` : '';
      const r = await dedupFetch(
        `${API_ROUTES.SLOTS}?salon_id=${business.id}&date=${selectedDate}${refetchSvc ? `&${refetchSvc}` : ''}`,
        {
          dedupKey: `slots-refetch:${business.id}:${selectedDate}:${refetchSvc || 'none'}`,
          cancelPrevious: true,
        }
      );
      const j = await r.json();
      if (j?.success) setSlots(Array.isArray(j.data) ? j.data : (j.data?.slots ?? []));
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        console.error('[PublicBookingPage] Refetch slots failed:', err);
      }
    }
  }, [business, selectedDate, setSlots, selectedServices]);

  const handleSlotSelect = useCallback(
    async (slot: Slot) => {
      if (slot.status === 'booked' || slot.status === 'reserved') {
        setError('This slot is no longer available. Please select another.');
        return;
      }

      setSelectedSlot(slot);
      setSlotValidationError(null);
      setError(null);

      const validationTimeoutId = setTimeout(() => {
        setValidatingSlot(true);
      }, 150);

      try {
        cancelRequests('slot-validate');
        const serviceIdsParam = JSON.stringify(selectedServices);
        const res = await dedupFetch(
          `/api/slots/${slot.id}?serviceIds=${encodeURIComponent(serviceIdsParam)}`,
          {
            credentials: 'include',
            dedupKey: `slot-validate:${slot.id}:${selectedServices.join(',')}`,
            cancelPrevious: true,
          }
        );
        const result = await res.json();

        clearTimeout(validationTimeoutId);

        if (!result?.success || result?.data?.status !== 'available') {
          setSlotValidationError('This slot was just booked. Please select another.');
          setSelectedSlot(null);
          await refetchSlots();
        }
      } catch (err) {
        clearTimeout(validationTimeoutId);
        if ((err as Error)?.name === 'AbortError') return;
        setSlotValidationError('Unable to verify slot availability. Please try again.');
      } finally {
        setValidatingSlot(false);
      }
    },
    [
      refetchSlots,
      setSelectedSlot,
      setSlotValidationError,
      setError,
      setValidatingSlot,
      selectedServices,
    ]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !selectedSlot || !business) return;
    if (!customerName.trim()) {
      setError('Please enter your name');
      return;
    }
    // ── Validate that at least one service is selected ────────────────────
    if (selectedServices.length === 0) {
      setError('Please select at least one service');
      return;
    }
    // ─────────────────────────────────────────────────────────────────────
    const phoneDigits = customerPhone.replace(/\D/g, '');
    if (!phoneDigits || phoneDigits.length !== PHONE_DIGITS) {
      setError(ERROR_MESSAGES.CUSTOMER_PHONE_INVALID);
      return;
    }
    setSubmitting(true);
    setError(null);
    setSlotValidationError(null);

    try {
      const sessionRes = await fetch('/api/auth/session', { credentials: 'include' });
      const sessionData = await sessionRes.json();
      const isAuthenticated = sessionData?.success && sessionData?.data?.user;

      if (!isAuthenticated) {
        savePendingBooking({
          businessSlug,
          selectedSlotId: selectedSlot.id,
          selectedDate,
          customerName: customerName.trim(),
          customerPhone: phoneDigits,
          savedAt: Date.now(),
        });
        const bookingPath = `/book/${businessSlug}`;
        router.push(ROUTES.AUTH_LOGIN(bookingPath) + '&role=customer');
        return;
      }

      const verifyRes = await fetch(`/api/slots/${selectedSlot.id}`);
      const verifyResult = await verifyRes.json();
      if (!verifyResult?.success || verifyResult?.data?.status !== 'available') {
        setSelectedSlot(null);
        await refetchSlots();
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
          date: selectedDate,
          customer_name: customerName.trim(),
          customer_phone: phoneDigits,
          service_ids: selectedServices, // Drives duration calculation
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          setSelectedSlot(null);
          await refetchSlots();
        }
        throw new Error(result?.error || 'Failed to create booking');
      }
      if (result?.success && result?.data) {
        setSuccess(result.data); // stops realtime listener
        clearPendingBooking();
        router.push(ROUTES.BOOKING_STATUS(result.data.booking.booking_id));
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      if (err instanceof Error && err.message.includes('no longer available')) {
        setSelectedSlot(null);
        await refetchSlots();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDateChange = useCallback(
    (newDate: string) => {
      if (newDate === selectedDate) return;

      setSelectedDate(newDate);
      setSelectedSlot(null);
      setClosedMessage(null);
      setError(null);

      const cached = slotCache.get(newDate);
      if (cached) {
        setSlots(cached);
        setDateLoading(false);
        return;
      }

      setDateLoading(true);
    },
    [
      selectedDate,
      slotCache,
      setSelectedDate,
      setSelectedSlot,
      setClosedMessage,
      setError,
      setSlots,
      setDateLoading,
    ]
  );

  const { businessOpenHour, businessCloseHour } = useMemo(
    () => ({
      businessOpenHour: business?.opening_time
        ? parseInt(business.opening_time.split(':')[0], 10)
        : 0,
      businessCloseHour: business?.closing_time
        ? parseInt(business.closing_time.split(':')[0], 10)
        : 24,
    }),
    [business?.opening_time, business?.closing_time]
  );

  const filteredSlots = useMemo(
    () => filterSlotsByBusinessHours(slots, selectedDate, businessOpenHour, businessCloseHour),
    [slots, selectedDate, businessOpenHour, businessCloseHour]
  );

  const isTodayClosed = useMemo(
    () => isToday(selectedDate) && isAfterBusinessHours(businessCloseHour),
    [selectedDate, businessCloseHour]
  );

  const breadcrumbItems = useMemo(
    () => [
      { label: 'My Activity', href: '/customer/dashboard' },
      { label: business?.salon_name || 'Book Appointment', href: `/customer/book/${businessSlug}` },
    ],
    [business?.salon_name, businessSlug]
  );

  if (isLoading) {
    return (
      <div className="w-full">
        <Breadcrumb
          items={[
            { label: 'My Activity', href: '/customer/dashboard' },
            { label: 'Loading...', href: `/customer/book/${businessSlug}` },
          ]}
        />
        <BookingPageSkeleton />
      </div>
    );
  }

  if (error && !business) {
    return (
      <div className="w-full">
        <Breadcrumb
          items={[
            { label: 'My Activity', href: '/customer/dashboard' },
            { label: 'Book Appointment', href: `/customer/book/${businessSlug}` },
          ]}
        />
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
    return <BookingSuccessView success={success} />;
  }

  return (
    <div className="w-full pb-24 flex flex-col gap-6">
      <Breadcrumb items={breadcrumbItems} />

      <div className="w-full">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900 mb-2">{business?.salon_name}</h1>
          <p className="text-slate-600 mb-8">{UI_CUSTOMER.BOOK_PAGE_SUB}</p>

          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              {UI_CUSTOMER.LABEL_SELECT_DATE}
            </label>
            <CalendarGrid
              selectedDate={selectedDate}
              setSelectedDate={handleDateChange}
              datesWithSlots={slotCache}
              closedDates={closedDates}
            />
          </div>

          {/* ── Multi-select Service Selection ─────────────────────────────── */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              {UI_CUSTOMER.LABEL_SELECT_SERVICE}
            </label>

            {services.length === 0 ? (
              <p className="text-sm text-slate-400">Loading services…</p>
            ) : (
              <div className="flex flex-col gap-2">
                {services.map((service) => {
                  const checked = selectedServices.includes(service.id);
                  return (
                    <label
                      key={service.id}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors ${
                        checked
                          ? 'border-slate-900 bg-slate-50'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleService(service.id)}
                        className="w-4 h-4 rounded accent-slate-900 cursor-pointer"
                      />
                      <span className="text-sm text-slate-800">{service.name}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
          {selectedDate && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                {UI_CUSTOMER.LABEL_SELECT_TIME}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
                <SlotSelectionGrid
                  isTodayClosed={isTodayClosed}
                  closingTime={business?.closing_time}
                  onSlotSelect={handleSlotSelect}
                />
              </div>
            </div>
          )}

          <CustomerBookingForm onSubmit={handleSubmit} />
        </div>
      </div>
    </div>
  );
}
