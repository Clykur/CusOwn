/**
 * Admin analytics: parse and clamp date range from query params.
 * UTC-normalized; max range 365 days; defensive for null/undefined.
 */

import { ADMIN_ANALYTICS_MAX_DAYS, ADMIN_DEFAULT_ANALYTICS_DAYS } from '@/config/constants';

export interface AdminDateRange {
  startDate: Date;
  endDate: Date;
  days: number;
}

/**
 * Start of day UTC for a given date string (YYYY-MM-DD) or Date.
 */
function startOfDayUTC(d: Date): Date {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
  return t;
}

/**
 * End of day UTC (23:59:59.999).
 */
function endOfDayUTC(d: Date): Date {
  const t = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999)
  );
  return t;
}

/**
 * Parse startDate and endDate from search params (ISO date or date-only).
 * Clamps range to ADMIN_ANALYTICS_MAX_DAYS. Defaults to last ADMIN_DEFAULT_ANALYTICS_DAYS.
 */
export function parseAdminDateRange(searchParams: URLSearchParams): AdminDateRange {
  const now = new Date();
  const maxDays = ADMIN_ANALYTICS_MAX_DAYS;
  const defaultDays = ADMIN_DEFAULT_ANALYTICS_DAYS;

  const startParam = searchParams.get('startDate')?.trim() || null;
  const endParam = searchParams.get('endDate')?.trim() || null;

  let startDate: Date;
  let endDate: Date;

  if (startParam && endParam) {
    startDate = new Date(startParam);
    endDate = new Date(endParam);
    if (Number.isNaN(startDate.getTime())) {
      startDate = new Date(now);
      startDate.setUTCDate(startDate.getUTCDate() - defaultDays);
    }
    if (Number.isNaN(endDate.getTime())) {
      endDate = new Date(now);
    }
    startDate = startOfDayUTC(startDate);
    endDate = endOfDayUTC(endDate);
    if (startDate > endDate) {
      const swap = startDate;
      startDate = endDate;
      endDate = swap;
    }
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
    if (days > maxDays) {
      startDate = new Date(endDate);
      startDate.setUTCDate(startDate.getUTCDate() - maxDays);
      startDate = startOfDayUTC(startDate);
    }
  } else {
    const daysParam = searchParams.get('days');
    const days = daysParam
      ? Math.min(Math.max(1, parseInt(daysParam, 10) || defaultDays), maxDays)
      : defaultDays;
    endDate = endOfDayUTC(new Date(now));
    startDate = new Date(endDate);
    startDate.setUTCDate(startDate.getUTCDate() - days + 1);
    startDate = startOfDayUTC(startDate);
  }

  const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
  return { startDate, endDate, days };
}

/**
 * Round to 2 decimal places for currency/percentages.
 */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
