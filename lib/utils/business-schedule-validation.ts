/**
 * Validates IST wall-clock times for weekly schedule and breaks.
 */

import { normalizeTime, timeToMinutes } from '@/lib/utils/time';
import { MAX_CONCURRENT_BOOKING_CAPACITY } from '@/config/constants';

export function isValidLatitude(lat: number): boolean {
  return Number.isFinite(lat) && lat >= -90 && lat <= 90;
}

export function isValidLongitude(lng: number): boolean {
  return Number.isFinite(lng) && lng >= -180 && lng <= 180;
}

export function validateConcurrentCapacity(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= MAX_CONCURRENT_BOOKING_CAPACITY;
}

/** True if half-open [a,b) is strictly inside [outerOpen, outerClose) in minutes. */
export function breakWithinWorkingHours(
  openMin: number,
  closeMin: number,
  breakStartMin: number,
  breakEndMin: number
): boolean {
  if (breakEndMin <= breakStartMin) return false;
  return breakStartMin >= openMin && breakEndMin <= closeMin;
}

export function parseTimeToMinutes(t: string | null | undefined): number | null {
  if (t == null || t === '') return null;
  return timeToMinutes(normalizeTime(t));
}
