import type { Slot } from '@/types';

const PENDING_BOOKING_KEY = 'pendingBooking';

/** Get local today string YYYY-MM-DD without timezone offset issues. */
export function getLocalTodayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** Returns true if the selected date is today (local). */
export function isToday(dateStr: string): boolean {
  return dateStr === getLocalTodayStr();
}

/** Returns true if business is currently closed (past closing hour today). */
export function isAfterBusinessHours(closeHour: number): boolean {
  const now = new Date();
  return now.getHours() >= closeHour;
}

/**
 * Filter slots based on the business's actual opening/closing hours.
 */
export function filterSlotsByBusinessHours(
  slots: Slot[],
  selectedDate: string,
  openHour: number,
  closeHour: number
): Slot[] {
  let filtered = slots.filter((slot) => {
    const [startH] = slot.start_time.split(':').map(Number);
    const [endH, endM] = slot.end_time.split(':').map(Number);
    const endMinutes = endH * 60 + endM;
    return startH >= openHour && endMinutes <= closeHour * 60;
  });

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

export type PendingBookingData = {
  businessSlug: string;
  selectedSlotId: string;
  selectedDate: string;
  customerName: string;
  customerPhone: string;
  savedAt: number;
};

export function savePendingBooking(data: PendingBookingData): void {
  try {
    localStorage.setItem(PENDING_BOOKING_KEY, JSON.stringify(data));
  } catch {
    // localStorage may be unavailable
  }
}

export function loadPendingBooking(): PendingBookingData | null {
  try {
    const raw = localStorage.getItem(PENDING_BOOKING_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as PendingBookingData;
    if (Date.now() - data.savedAt > 30 * 60 * 1000) {
      localStorage.removeItem(PENDING_BOOKING_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function clearPendingBooking(): void {
  try {
    localStorage.removeItem(PENDING_BOOKING_KEY);
  } catch {
    // ignore
  }
}

const REBOOK_DATA_KEY = 'rebookData';

export function getInitialRebookData(): { name: string; phone: string; applied: boolean } {
  if (typeof window === 'undefined') return { name: '', phone: '', applied: false };
  const raw = sessionStorage.getItem(REBOOK_DATA_KEY);
  if (!raw) return { name: '', phone: '', applied: false };
  try {
    const data = JSON.parse(raw);
    if (data.name || data.phone) {
      return { name: data.name ?? '', phone: data.phone ?? '', applied: true };
    }
  } catch {
    sessionStorage.removeItem(REBOOK_DATA_KEY);
  }
  return { name: '', phone: '', applied: false };
}

/** Set customer name/phone for Rebook so the booking page can prefill the form. */
export function setRebookData(name: string, phone: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(REBOOK_DATA_KEY, JSON.stringify({ name, phone }));
  } catch {
    // sessionStorage may be unavailable
  }
}
