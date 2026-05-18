'use client';

import { create } from 'zustand';

type ToastVariant = 'success' | 'error' | 'default';

interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  duration?: number;
}

interface ModalState {
  isOpen: boolean;
  data?: unknown;
}

interface UIState {
  toasts: Toast[];
  globalLoading: boolean;
  loadingMessage: string | null;

  modals: Record<string, ModalState>;

  showToast: (message: string, variant?: ToastVariant, duration?: number) => string;
  dismissToast: (id: string) => void;
  clearToasts: () => void;

  setGlobalLoading: (loading: boolean, message?: string | null) => void;

  openModal: (modalId: string, data?: unknown) => void;
  closeModal: (modalId: string) => void;
  isModalOpen: (modalId: string) => boolean;
  getModalData: <T>(modalId: string) => T | undefined;

  reset: () => void;
}

let toastIdCounter = 0;

const generateToastId = () => {
  toastIdCounter += 1;
  return `toast-${Date.now()}-${toastIdCounter}`;
};

const initialState = {
  toasts: [],
  globalLoading: false,
  loadingMessage: null,
  modals: {},
};

export const useUIStore = create<UIState>()((set, get) => ({
  ...initialState,

  showToast: (message, variant = 'default', duration = 3000) => {
    const id = generateToastId();
    const toast: Toast = { id, message, variant, duration };

    set((state) => ({
      toasts: [...state.toasts, toast],
    }));

    if (duration > 0) {
      setTimeout(() => {
        get().dismissToast(id);
      }, duration);
    }

    return id;
  },

  dismissToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  clearToasts: () => set({ toasts: [] }),

  setGlobalLoading: (globalLoading, loadingMessage = null) =>
    set({ globalLoading, loadingMessage }),

  openModal: (modalId, data) =>
    set((state) => ({
      modals: {
        ...state.modals,
        [modalId]: { isOpen: true, data },
      },
    })),

  closeModal: (modalId) =>
    set((state) => ({
      modals: {
        ...state.modals,
        [modalId]: { isOpen: false, data: undefined },
      },
    })),

  isModalOpen: (modalId) => get().modals[modalId]?.isOpen ?? false,

  getModalData: <T>(modalId: string) => get().modals[modalId]?.data as T | undefined,

  reset: () => set(initialState),
}));

export const MODAL_IDS = {
  EDIT_BUSINESS: 'edit-business',
  CONFIRM_DELETE: 'confirm-delete',
  RESCHEDULE_BOOKING: 'reschedule-booking',
} as const;

export type { Toast, ToastVariant, ModalState, UIState };
