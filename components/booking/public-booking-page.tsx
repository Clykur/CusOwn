'use client';

import { useEffect, useCallback, useRef, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  API_ROUTES,
  BOOKING_IDEMPOTENCY_HEADER,
  CUSTOMER_SCREEN_TITLE_CLASSNAME,
  ERROR_MESSAGES,
  PHONE_DIGITS,
  UI_CUSTOMER,
} from '@/config/constants';
import { ROUTES } from '@/lib/utils/navigation';
import { generateUuidV7 } from '@/lib/uuid';
import type { Slot } from '@/types';
import { logError } from '@/lib/utils/error-handler';
import { getCSRFToken } from '@/lib/utils/csrf-client';
import {
  BookingPageSkeleton,
  CalendarGridLoadingSkeleton,
  SlotGridSkeleton,
} from '@/components/ui/skeleton';
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
import { cn } from '@/lib/utils/cn';
import { dedupFetch, cancelRequests, cancelDebounce } from '@/lib/utils/fetch-dedup';
import { useBookingFlowStore } from '@/lib/store';

import SlotSelectionGrid from './slot-selection-grid';
import CustomerBookingForm from './customer-booking-form';

const CalendarGrid = dynamic(() => import('@/components/booking/calendar-grid'), {
  ssr: false,
  loading: () => <CalendarGridLoadingSkeleton cells={14} />,
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
  /** Apply `?serviceId=` to selection only once — avoids re-adding after the user deselects. */
  const urlServiceIdSeededRef = useRef(false);

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
  const reset = useBookingFlowStore((state) => state.reset);

  const midnightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slotRefreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [, setTimeTick] = useState(0);
  const restoredFromPendingRef = useRef(false);
  const [services, setServices] = useState<
    {
      id: string;
      business_id: string;
      name: string;
      description?: string | null;
      duration_minutes: number;
      price_cents: number;
      is_active: boolean;
      created_at: string;
      updated_at: string;
    }[]
  >([]);

  const searchParams = useSearchParams();
  const serviceId = searchParams?.get('serviceId') ?? null;

  // ── Multi-select: array instead of single string ──────────────────────────
  const [selectedServices, setSelectedServices] = useState<string[]>([]);

  const serverBusinessPreview = useMemo(
    () => (initialBusiness ? toPublicBusiness(initialBusiness) : null),
    [initialBusiness]
  );
  const displayBusiness = business ?? serverBusinessPreview;
  const businessIdMemo = useMemo(() => displayBusiness?.id ?? null, [displayBusiness?.id]);
  const servicesKey = useMemo(() => selectedServices.slice().sort().join(','), [selectedServices]);

  const toggleService = useCallback((id: string) => {
    setSelectedServices((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }, []);

  useEffect(() => {
    if (!businessIdMemo) return;

    const fetchServices = async () => {
      try {
        const res = await fetch(`/api/public/services?businessId=${businessIdMemo}`);
        const data = await res.json();

        if (data.success) {
          setServices(data.data);
          if (
            !urlServiceIdSeededRef.current &&
            serviceId &&
            data.data.some((s: any) => s.id === serviceId)
          ) {
            setSelectedServices([serviceId]);
            urlServiceIdSeededRef.current = true;
          }
        } else {
          console.error('Services API error:', data);
        }
      } catch (err) {
        console.error('Error fetching services:', err);
      }
    };

    fetchServices();
  }, [businessIdMemo, businessSlug, serviceId]);

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
    businessId: businessIdMemo,
    date: selectedDate,
    slots,
    onSlotsUpdate: handleRealtimeSlotsUpdate,
    onSlotChange: handleSlotStatusChange,
    enabled: !!businessIdMemo && !!selectedDate,
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
        const closeH = displayBusiness?.closing_time
          ? parseInt(displayBusiness.closing_time.split(':')[0], 10)
          : 24;
        if (h * 60 + m <= now.getHours() * 60 + now.getMinutes() || isAfterBusinessHours(closeH)) {
          setSelectedSlot(null);
        }
      }
    }, 60_000);
    return () => {
      if (slotRefreshTimerRef.current) clearInterval(slotRefreshTimerRef.current);
    };
  }, [selectedDate, selectedSlot, displayBusiness?.closing_time, setSelectedSlot, setTimeTick]);

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

  const isFetchingSlots = useRef(false);

  // Dedicated slots fetch with debounce, guard, minimal deps
  useEffect(() => {
    if (!businessIdMemo || !selectedDate || isFetchingSlots.current) return;

    let timeoutId: NodeJS.Timeout;

    const debouncedFetch = async () => {
      isFetchingSlots.current = true;
      const requestDate = selectedDate;

      const cached = slotCache.get(requestDate);
      if (cached !== undefined) {
        if (useBookingFlowStore.getState().selectedDate !== requestDate) {
          isFetchingSlots.current = false;
          return;
        }
        setClosedMessage(null);
        setSlots(cached);
        setDateLoading(false);
        isFetchingSlots.current = false;
        return;
      }

      setDateLoading(true);
      setClosedMessage(null);
      cancelRequests(`slots:${businessIdMemo}`);

      const serviceIdsParam = servicesKey ? `serviceIds=${servicesKey}` : '';
      const fetchUrl = `${API_ROUTES.SLOTS}?salon_id=${businessIdMemo}&date=${requestDate}${serviceIdsParam ? '&' + serviceIdsParam : ''}`;
      try {
        const res = await dedupFetch(fetchUrl, {
          credentials: 'include',
          dedupKey: `slots:${businessIdMemo}:${requestDate}:${servicesKey || 'none'}`,
          cancelPrevious: true,
        });
        const result = await res.json();

        if (useBookingFlowStore.getState().selectedDate !== requestDate) {
          isFetchingSlots.current = false;
          setDateLoading(false);
          return;
        }

        if (result?.success && result?.data) {
          if (result.data.closed) {
            setClosedMessage(result.data.message || 'Shop is closed on this day.');
            setSlots([]);
            addClosedDate(requestDate);
            cacheSlots(requestDate, []);
            return;
          }
          setClosedMessage(null);
          const loadedSlots: Slot[] = Array.isArray(result.data)
            ? result.data
            : (result.data.slots ?? []);
          setSlots(loadedSlots);
          cacheSlots(requestDate, loadedSlots);
          removeClosedDate(requestDate);

          // Rebook logic (one-time)
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

          // Restore pending (conditional)
          if (!restoredFromPendingRef.current && !rebookAppliedRef.current) {
            restorePendingBooking(loadedSlots);
          } else if (rebookAppliedRef.current && !restoredFromPendingRef.current) {
            restoredFromPendingRef.current = true;
          }

          // Validate selected slot
          if (selectedSlot) {
            const updated = loadedSlots.find((s: Slot) => s.id === selectedSlot.id);
            if (!updated || updated.status !== 'available') {
              setSelectedSlot(null);
              if (updated?.status !== 'available')
                setSlotValidationError(UI_CUSTOMER.SLOT_NO_LONGER_AVAILABLE);
            }
          }
        }
      } catch (err) {
        if ((err as Error)?.name !== 'AbortError') {
          console.error('[PublicBookingPage] Failed to fetch slots:', err);
        }
      } finally {
        isFetchingSlots.current = false;
        setDateLoading(false);
      }
    };

    timeoutId = setTimeout(debouncedFetch, 300);

    return () => clearTimeout(timeoutId);
  }, [
    businessIdMemo,
    selectedDate,
    servicesKey,
    slotCache,
    restorePendingBooking,
    addClosedDate,
    cacheSlots,
    removeClosedDate,
    selectedSlot,
    setClosedMessage,
    setCustomerName,
    setCustomerPhone,
    setDateLoading,
    setSelectedSlot,
    setSlotValidationError,
    setSlots,
  ]);

  const refetchSlots = useCallback(async () => {
    if (!businessIdMemo || isFetchingSlots.current) return;
    const requestDate = selectedDate;

    try {
      const serviceIdsParam = servicesKey ? `serviceIds=${servicesKey}` : '';
      const r = await dedupFetch(
        `${API_ROUTES.SLOTS}?salon_id=${businessIdMemo}&date=${requestDate}${serviceIdsParam ? '&' + serviceIdsParam : ''}`,
        {
          dedupKey: `slots-refetch:${businessIdMemo}:${requestDate}:${servicesKey || 'none'}`,
          cancelPrevious: true,
        }
      );
      const j = await r.json();
      if (useBookingFlowStore.getState().selectedDate !== requestDate) return;
      if (j?.success) {
        const newSlots = Array.isArray(j.data) ? j.data : (j.data?.slots ?? []);
        setSlots(newSlots);
        cacheSlots(requestDate, newSlots);
      }
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        console.error('[PublicBookingPage] Refetch slots failed:', err);
      }
    }
  }, [businessIdMemo, selectedDate, servicesKey, setSlots, cacheSlots]);

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
          setTimeout(refetchSlots, 0);
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
    if (submitting || !selectedSlot || !displayBusiness) return;
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
        setTimeout(refetchSlots, 0);
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
          salon_id: displayBusiness.id,
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
          setTimeout(refetchSlots, 0);
        }
        throw new Error(result?.error || 'Failed to create booking');
      }
      if (result?.success && result?.data) {
        clearPendingBooking();
        router.push(ROUTES.BOOKING_STATUS(result.data.booking.booking_id));
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      if (err instanceof Error && err.message.includes('no longer available')) {
        setSelectedSlot(null);
        setTimeout(refetchSlots, 0);
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
      businessOpenHour: displayBusiness?.opening_time
        ? parseInt(displayBusiness.opening_time.split(':')[0], 10)
        : 0,
      businessCloseHour: displayBusiness?.closing_time
        ? parseInt(displayBusiness.closing_time.split(':')[0], 10)
        : 24,
    }),
    [displayBusiness?.opening_time, displayBusiness?.closing_time]
  );

  const filteredSlots = useMemo(
    () => filterSlotsByBusinessHours(slots, selectedDate, businessOpenHour, businessCloseHour),
    [slots, selectedDate, businessOpenHour, businessCloseHour]
  );

  const isTodayClosed = useMemo(
    () => isToday(selectedDate) && isAfterBusinessHours(businessCloseHour),
    [selectedDate, businessCloseHour]
  );

  /** Clear selection when day changes, shop closes, or filters remove the slot (e.g. past times). */
  useEffect(() => {
    if (!selectedSlot) return;
    const stillVisible = filteredSlots.some((s) => s.id === selectedSlot.id);
    if (!stillVisible) setSelectedSlot(null);
  }, [filteredSlots, selectedSlot, setSelectedSlot]);

  /** Avoid loading skeleton when SSR passed business — matches server HTML and prevents hydration mismatch. */
  const showLoadingShell = isLoading && !serverBusinessPreview;

  const breadcrumbItems = useMemo(
    () => [
      { label: 'My Activity', href: '/customer/dashboard' },
      {
        label: displayBusiness?.salon_name || 'Book Appointment',
        href: `/customer/book/${businessSlug}`,
      },
    ],
    [displayBusiness?.salon_name, businessSlug]
  );

  if (showLoadingShell) {
    return (
      <div className="w-full space-y-4 pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:pb-8">
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

  if (error && !displayBusiness) {
    return (
      <div className="w-full space-y-4 pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:pb-8">
        <Breadcrumb
          items={[
            { label: 'My Activity', href: '/customer/dashboard' },
            { label: 'Book Appointment', href: `/customer/book/${businessSlug}` },
          ]}
        />
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 text-center shadow-sm sm:p-8">
          <h2 className={cn(CUSTOMER_SCREEN_TITLE_CLASSNAME, 'mb-3')}>
            {ERROR_MESSAGES.SALON_NOT_FOUND}
          </h2>
          <p className="text-sm leading-relaxed text-slate-600 sm:text-base">{error}</p>
        </div>
      </div>
    );
  }

  // if (success) {
  //   return <BookingSuccessView success={success} />;
  // }

  const sectionLabelClass =
    'mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500';

  return (
    <div className="flex w-full flex-col gap-4 pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] sm:gap-6 md:pb-8">
      <Breadcrumb items={breadcrumbItems} />

      <div className="w-full">
        <div
          className={cn(
            'rounded-2xl bg-white',
            'max-md:border-0 max-md:bg-transparent max-md:p-0 max-md:shadow-none',
            'md:border md:border-slate-200/90 md:p-6 md:shadow-sm lg:p-8'
          )}
        >
          <header className="mb-6 border-b border-slate-100 pb-5 max-md:mb-5 max-md:pb-4">
            <h1 className={cn(CUSTOMER_SCREEN_TITLE_CLASSNAME, 'break-words')}>
              {displayBusiness?.salon_name}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 sm:text-base">
              {UI_CUSTOMER.BOOK_PAGE_SUB}
            </p>
          </header>

          <div className="mb-6 md:mb-8">
            <p className={sectionLabelClass}>{UI_CUSTOMER.LABEL_SELECT_SERVICE}</p>

            {services.length === 0 ? (
              <p className="text-sm text-slate-400">Loading services…</p>
            ) : (
              <div className="flex flex-col gap-2">
                {services.map((service) => {
                  const checked = selectedServices.includes(service.id);
                  return (
                    <label
                      key={service.id}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3.5 transition-colors sm:gap-4 sm:px-5 sm:py-4',
                        checked
                          ? 'border-slate-900 bg-slate-50 shadow-sm'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70'
                      )}
                    >
                      <div className="flex shrink-0 items-center self-stretch">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleService(service.id)}
                          className="h-5 w-5 cursor-pointer rounded border-slate-300 text-slate-900 accent-slate-900 focus:ring-2 focus:ring-slate-400 focus:ring-offset-0"
                          aria-describedby={`service-meta-${service.id}`}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-base font-medium text-slate-900">
                          {service.name}
                        </span>
                        <span
                          id={`service-meta-${service.id}`}
                          className="mt-0.5 block text-xs text-slate-500"
                        >
                          {service.duration_minutes} min
                        </span>
                      </div>
                      <span className="shrink-0 text-base font-semibold tabular-nums tracking-tight text-slate-900">
                        ₹{(service.price_cents / 100).toFixed(0)}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mb-6 md:mb-8">
            <p className={sectionLabelClass}>{UI_CUSTOMER.LABEL_SELECT_DATE}</p>
            <div>
              <CalendarGrid
                rangeAnchorDate={initialDate ?? undefined}
                selectedDate={selectedDate}
                setSelectedDate={handleDateChange}
                datesWithSlots={slotCache}
                closedDates={closedDates}
              />
            </div>
          </div>

          {selectedDate ? (
            <div className="mb-6 md:mb-8">
              <p className={sectionLabelClass}>{UI_CUSTOMER.LABEL_SELECT_TIME}</p>
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 sm:p-4">
                <div className="flex flex-wrap gap-2">
                  <SlotSelectionGrid
                    displaySlots={filteredSlots}
                    isTodayClosed={isTodayClosed}
                    closingTime={displayBusiness?.closing_time}
                    onSlotSelect={handleSlotSelect}
                  />
                </div>
              </div>
            </div>
          ) : null}

          <div className="max-md:rounded-2xl max-md:border max-md:border-slate-200/90 max-md:bg-slate-50/40 max-md:p-4">
            <CustomerBookingForm onSubmit={handleSubmit} />
          </div>
        </div>
      </div>
    </div>
  );
}
