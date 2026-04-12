'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Salon, Slot } from '@/types';

interface Holiday {
  id: string;
  holiday_date: string;
  holiday_name?: string;
}

interface Closure {
  id: string;
  start_date: string;
  end_date: string;
  reason?: string;
}

interface ReviewData {
  rating_avg: number;
  review_count: number;
  rating_counts: Record<number, number>;
}

interface ShopPhoto {
  id: string;
  url: string;
}

interface OwnerBusinessState {
  salon: Salon | null;
  slots: Slot[];
  selectedDate: string;
  activeTab: 'slots' | 'downtime';

  holidays: Holiday[];
  closures: Closure[];

  shopPhotos: ShopPhoto[];
  photosLoading: boolean;
  uploadingPhotos: boolean;
  deletingPhotoIds: Set<string>;

  reviewData: ReviewData | null;

  isLoading: boolean;
  error: string | null;

  setSalon: (salon: Salon | null) => void;
  updateSalon: (updates: Partial<Salon>) => void;
  setSlots: (slots: Slot[]) => void;
  updateSlot: (slotId: string, updates: Partial<Slot>) => void;
  setSelectedDate: (date: string) => void;
  setActiveTab: (tab: 'slots' | 'downtime') => void;

  setHolidays: (holidays: Holiday[]) => void;
  addHoliday: (holiday: Holiday) => void;
  removeHoliday: (holidayId: string) => void;
  setClosures: (closures: Closure[]) => void;
  addClosure: (closure: Closure) => void;
  removeClosure: (closureId: string) => void;

  setShopPhotos: (photos: ShopPhoto[]) => void;
  addShopPhoto: (photo: ShopPhoto) => void;
  removeShopPhoto: (photoId: string) => void;
  setPhotosLoading: (loading: boolean) => void;
  setUploadingPhotos: (uploading: boolean) => void;
  addDeletingPhotoId: (id: string) => void;
  removeDeletingPhotoId: (id: string) => void;

  setReviewData: (data: ReviewData | null) => void;

  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const getInitialDate = () => new Date().toISOString().split('T')[0];

const initialState = {
  salon: null,
  slots: [],
  selectedDate: getInitialDate(),
  activeTab: 'slots' as const,
  holidays: [],
  closures: [],
  shopPhotos: [],
  photosLoading: false,
  uploadingPhotos: false,
  deletingPhotoIds: new Set<string>(),
  reviewData: null,
  isLoading: true,
  error: null,
};

export const useOwnerBusinessStore = create<OwnerBusinessState>()(
  persist(
    (set) => ({
      ...initialState,

      setSalon: (salon) => set({ salon }),

      updateSalon: (updates) =>
        set((state) => ({
          salon: state.salon ? { ...state.salon, ...updates } : null,
        })),

      setSlots: (slots) => set({ slots }),

      updateSlot: (slotId, updates) =>
        set((state) => ({
          slots: state.slots.map((s) => (s.id === slotId ? { ...s, ...updates } : s)),
        })),

      setSelectedDate: (selectedDate) => set({ selectedDate }),

      setActiveTab: (activeTab) => set({ activeTab }),

      setHolidays: (holidays) => set({ holidays }),

      addHoliday: (holiday) => set((state) => ({ holidays: [...state.holidays, holiday] })),

      removeHoliday: (holidayId) =>
        set((state) => ({
          holidays: state.holidays.filter((h) => h.id !== holidayId),
        })),

      setClosures: (closures) => set({ closures }),

      addClosure: (closure) => set((state) => ({ closures: [...state.closures, closure] })),

      removeClosure: (closureId) =>
        set((state) => ({
          closures: state.closures.filter((c) => c.id !== closureId),
        })),

      setShopPhotos: (shopPhotos) => set({ shopPhotos }),

      addShopPhoto: (photo) => set((state) => ({ shopPhotos: [...state.shopPhotos, photo] })),

      removeShopPhoto: (photoId) =>
        set((state) => ({
          shopPhotos: state.shopPhotos.filter((p) => p.id !== photoId),
        })),

      setPhotosLoading: (photosLoading) => set({ photosLoading }),

      setUploadingPhotos: (uploadingPhotos) => set({ uploadingPhotos }),

      addDeletingPhotoId: (id) =>
        set((state) => ({
          deletingPhotoIds: new Set(state.deletingPhotoIds).add(id),
        })),

      removeDeletingPhotoId: (id) =>
        set((state) => {
          const next = new Set(state.deletingPhotoIds);
          next.delete(id);
          return { deletingPhotoIds: next };
        }),

      setReviewData: (reviewData) => set({ reviewData }),

      setIsLoading: (isLoading) => set({ isLoading }),

      setError: (error) => set({ error }),

      reset: () => set({ ...initialState, selectedDate: getInitialDate() }),
    }),
    {
      name: 'owner-business-store',
      partialize: (state) => ({
        selectedDate: state.selectedDate,
        activeTab: state.activeTab,
      }),
    }
  )
);

export type { Holiday, Closure, ReviewData, ShopPhoto, OwnerBusinessState };
