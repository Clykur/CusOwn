/**
 * Unit tests: lib/utils/business-schedule-validation
 */
import { describe, expect, it } from 'vitest';
import {
  breakWithinWorkingHours,
  isValidLatitude,
  isValidLongitude,
  parseTimeToMinutes,
  validateConcurrentCapacity,
} from '@/lib/utils/business-schedule-validation';
import { MAX_CONCURRENT_BOOKING_CAPACITY } from '@/config/constants';

describe('business-schedule-validation', function () {
  it('should_validate_latitude_bounds_and_finite', function () {
    expect(isValidLatitude(0)).toBe(true);
    expect(isValidLatitude(-90)).toBe(true);
    expect(isValidLatitude(90)).toBe(true);
    expect(isValidLatitude(91)).toBe(false);
    expect(isValidLatitude(-91)).toBe(false);
    expect(isValidLatitude(Number.NaN)).toBe(false);
    expect(isValidLatitude(Number.POSITIVE_INFINITY)).toBe(false);
  });

  it('should_validate_longitude_bounds_and_finite', function () {
    expect(isValidLongitude(0)).toBe(true);
    expect(isValidLongitude(-180)).toBe(true);
    expect(isValidLongitude(180)).toBe(true);
    expect(isValidLongitude(181)).toBe(false);
    expect(isValidLongitude(-181)).toBe(false);
    expect(isValidLongitude(Number.NaN)).toBe(false);
  });

  it('should_validate_concurrent_capacity_integer_range', function () {
    expect(validateConcurrentCapacity(1)).toBe(true);
    expect(validateConcurrentCapacity(MAX_CONCURRENT_BOOKING_CAPACITY)).toBe(true);
    expect(validateConcurrentCapacity(0)).toBe(false);
    expect(validateConcurrentCapacity(MAX_CONCURRENT_BOOKING_CAPACITY + 1)).toBe(false);
    expect(validateConcurrentCapacity(1.5)).toBe(false);
  });

  it('should_reject_break_when_end_not_after_start', function () {
    expect(breakWithinWorkingHours(100, 200, 120, 120)).toBe(false);
    expect(breakWithinWorkingHours(100, 200, 130, 120)).toBe(false);
  });

  it('should_accept_break_strictly_inside_hours', function () {
    expect(breakWithinWorkingHours(540, 1020, 600, 660)).toBe(true);
  });

  it('should_reject_break_outside_window', function () {
    expect(breakWithinWorkingHours(540, 1020, 500, 560)).toBe(false);
    expect(breakWithinWorkingHours(540, 1020, 900, 1100)).toBe(false);
  });

  it('should_parse_time_to_minutes_or_null', function () {
    expect(parseTimeToMinutes(null)).toBeNull();
    expect(parseTimeToMinutes(undefined)).toBeNull();
    expect(parseTimeToMinutes('')).toBeNull();
    expect(parseTimeToMinutes('09:30')).not.toBeNull();
  });
});
