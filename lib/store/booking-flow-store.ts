'use client';

import { create } from 'zustand';
import { PHONE_DIGITS } from '@/config/constants';
import type { PublicBusiness, Slot } from '@/types';
import type { BookingSuccessData } from '@/components/booking/booking-success-view';

interface BookingFlowState {
  business: PublicBusiness | null;
  businessSlug: string;

  selectedDate: string;
  selectedSlot: Slot | null;
  slots: Slot[];
  slotCache: Map<string, Slot[]>;
  closedDates: Set<string>;
  closedMessage: string | null;

  customerName: string;
  customerPhone: string;

  isLoading: boolean;
  dateLoading: boolean;
  validatingSlot: boolean;
  submitting: boolean;
  error: string | null;
  slotValidationError: string | null;

  success: BookingSuccessData | null;

  setBusiness: (business: PublicBusiness | null) => void;
  setBusinessSlug: (slug: string) => void;

  setSelectedDate: (date: string) => void;
  setSelectedSlot: (slot: Slot | null) => void;
  setSlots: (slots: Slot[]) => void;
  updateSlot: (slotId: string, updates: Partial<Slot>) => void;
  cacheSlots: (date: string, slots: Slot[]) => void;
  getCachedSlots: (date: string) => Slot[] | undefined;
  addClosedDate: (date: string) => void;
  addClosedDates: (dates: string[]) => void;
  removeClosedDate: (date: string) => void;
  setClosedMessage: (message: string | null) => void;

  setCustomerName: (name: string) => void;
  setCustomerPhone: (phone: string) => void;

  setIsLoading: (loading: boolean) => void;
  setDateLoading: (loading: boolean) => void;
  setValidatingSlot: (validating: boolean) => void;
  setSubmitting: (submitting: boolean) => void;
  setError: (error: string | null) => void;
  setSlotValidationError: (error: string | null) => void;

  setSuccess: (data: BookingSuccessData | null) => void;

  clearSelection: () => void;
  clearForm: () => void;
  reset: () => void;
}

const getLocalTodayStr = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const initialState = {
  business: null,
  businessSlug: '',
  selectedDate: getLocalTodayStr(),
  selectedSlot: null,
  slots: [],
  slotCache: new Map<string, Slot[]>(),
  closedDates: new Set<string>(),
  closedMessage: null,
  customerName: '',
  customerPhone: '',
  isLoading: true,
  dateLoading: false,
  validatingSlot: false,
  submitting: false,
  error: null,
  slotValidationError: null,
  success: null,
};

export const useBookingFlowStore = create<BookingFlowState>()((set, get) => ({
  ...initialState,

  setBusiness: (business) => set({ business }),

  setBusinessSlug: (businessSlug) => set({ businessSlug }),

  setSelectedDate: (selectedDate) => {
    const cached = get().slotCache.get(selectedDate);
    set({
      selectedDate,
      selectedSlot: null,
      slotValidationError: null,
      error: null,
      slots: cached ?? [],
      dateLoading: cached === undefined,
    });
  },

  setSelectedSlot: (selectedSlot) => set({ selectedSlot, slotValidationError: null }),

  setSlots: (slots) => set({ slots }),

  updateSlot: (slotId, updates) =>
    set((state) => {
      const nextSlots = state.slots.map((slot) =>
        slot.id === slotId ? { ...slot, ...updates } : slot
      );

      const nextCache = new Map(state.slotCache);
      nextCache.set(state.selectedDate, nextSlots);

      const nextSelectedSlot =
        state.selectedSlot?.id === slotId
          ? { ...state.selectedSlot, ...updates }
          : state.selectedSlot;

      return {
        slots: nextSlots,
        slotCache: nextCache,
        selectedSlot: nextSelectedSlot,
      };
    }),

  cacheSlots: (date, slots) =>
    set((state) => {
      const next = new Map(state.slotCache);
      next.set(date, slots);
      return { slotCache: next, slots: state.selectedDate === date ? slots : state.slots };
    }),

  getCachedSlots: (date) => get().slotCache.get(date),

  addClosedDate: (date) =>
    set((state) => ({
      closedDates: new Set(state.closedDates).add(date),
    })),

  addClosedDates: (dates) =>
    set((state) => {
      const next = new Set(state.closedDates);
      dates.forEach((d) => next.add(d));
      return { closedDates: next };
    }),

  removeClosedDate: (date) =>
    set((state) => {
      const next = new Set(state.closedDates);
      next.delete(date);
      return { closedDates: next };
    }),

  setClosedMessage: (closedMessage) => set({ closedMessage }),

  setCustomerName: (customerName) => set({ customerName }),

  setCustomerPhone: (customerPhone) =>
    set({
      customerPhone: customerPhone.replace(/\D/g, '').slice(-PHONE_DIGITS),
    }),

  setIsLoading: (isLoading) => set({ isLoading }),

  setDateLoading: (dateLoading) => set({ dateLoading }),

  setValidatingSlot: (validatingSlot) => set({ validatingSlot }),

  setSubmitting: (submitting) => set({ submitting }),

  setError: (error) => set({ error }),

  setSlotValidationError: (slotValidationError) => set({ slotValidationError }),

  setSuccess: (success) => set({ success }),

  clearSelection: () => set({ selectedSlot: null, slotValidationError: null }),

  clearForm: () => set({ customerName: '', customerPhone: '' }),

  reset: () =>
    set({
      ...initialState,
      selectedDate: getLocalTodayStr(),
      slotCache: new Map(),
      closedDates: new Set(),
    }),
}));

export const selectAvailableSlots = (state: BookingFlowState) =>
  state.slots.filter((s) => s.status === 'available');

export const selectIsDateClosed = (state: BookingFlowState) =>
  state.closedDates.has(state.selectedDate);

export type { BookingFlowState };
