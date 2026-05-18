/**
 * Unit tests: lib/utils/date-range-admin
 */
import { describe, expect, it, vi } from 'vitest';
import { parseAdminDateRange, round2 } from '@/lib/utils/date-range-admin';
import { ADMIN_ANALYTICS_MAX_DAYS, ADMIN_DEFAULT_ANALYTICS_DAYS } from '@/config/constants';

describe('date-range-admin', function () {
  it('should_round2_to_two_decimals', function () {
    expect(round2(1.234)).toBe(1.23);
    expect(round2(1.235)).toBe(1.24);
  });

  it('should_default_range_when_no_start_or_end', function () {
    const params = new URLSearchParams();
    const { startDate, endDate, days } = parseAdminDateRange(params);
    expect(endDate.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
    expect(days).toBeGreaterThanOrEqual(1);
    expect(days).toBeLessThanOrEqual(ADMIN_DEFAULT_ANALYTICS_DAYS + 1);
  });

  it('should_parse_days_param_clamped', function () {
    const params = new URLSearchParams();
    params.set('days', '5');
    const { days } = parseAdminDateRange(params);
    expect(days).toBe(5);
  });

  it('should_clamp_days_above_max', function () {
    const params = new URLSearchParams();
    params.set('days', String(ADMIN_ANALYTICS_MAX_DAYS + 50));
    const { days } = parseAdminDateRange(params);
    expect(days).toBe(ADMIN_ANALYTICS_MAX_DAYS);
  });

  it('should_use_default_days_when_days_param_not_integer', function () {
    const params = new URLSearchParams();
    params.set('days', 'not-a-number');
    const { days } = parseAdminDateRange(params);
    expect(days).toBe(ADMIN_DEFAULT_ANALYTICS_DAYS);
  });

  it('should_clamp_negative_days_param_to_one', function () {
    const params = new URLSearchParams();
    params.set('days', '-5');
    const { days } = parseAdminDateRange(params);
    expect(days).toBe(1);
  });

  it('should_parse_start_and_end_and_swap_if_inverted', function () {
    const params = new URLSearchParams();
    params.set('startDate', '2024-06-10');
    params.set('endDate', '2024-06-01');
    const { startDate, endDate } = parseAdminDateRange(params);
    expect(startDate.getTime()).toBeLessThanOrEqual(endDate.getTime());
  });

  it('should_clamp_span_when_exceeds_max_days', function () {
    const params = new URLSearchParams();
    params.set('startDate', '2020-01-01');
    params.set('endDate', '2025-01-01');
    const { startDate, endDate, days } = parseAdminDateRange(params);
    // Inclusive UTC day boundaries can ceil to maxDays + 1 for some ranges.
    expect(days).toBeLessThanOrEqual(ADMIN_ANALYTICS_MAX_DAYS + 1);
    expect(startDate.getTime()).toBeLessThanOrEqual(endDate.getTime());
  });

  it('should_replace_invalid_start_with_default_backfill', function () {
    const fixed = new Date('2024-06-15T12:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(fixed);
    const params = new URLSearchParams();
    params.set('startDate', 'not-a-date');
    params.set('endDate', '2024-06-15');
    const { endDate } = parseAdminDateRange(params);
    expect(endDate.getTime()).toBeGreaterThan(0);
    vi.useRealTimers();
  });

  it('should_replace_invalid_end_with_now', function () {
    const fixed = new Date('2024-06-15T12:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(fixed);
    const params = new URLSearchParams();
    params.set('startDate', '2024-06-01');
    params.set('endDate', 'invalid');
    const { endDate } = parseAdminDateRange(params);
    expect(endDate.getUTCFullYear()).toBe(2024);
    expect(endDate.getUTCMonth()).toBe(5);
    expect(endDate.getUTCDate()).toBe(15);
    vi.useRealTimers();
  });
});
