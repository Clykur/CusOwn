/**
 * Unit tests: lib/utils/analytics-chart-format
 */
import { describe, expect, it } from 'vitest';
import { formatAnalyticsChartDayLabel } from '@/lib/utils/analytics-chart-format';

describe('formatAnalyticsChartDayLabel', function () {
  it('should_return_iso_string_when_not_three_parts', function () {
    expect(formatAnalyticsChartDayLabel('2024-01')).toBe('2024-01');
  });

  it('should_return_iso_string_when_part_is_not_finite', function () {
    expect(formatAnalyticsChartDayLabel('2024-xx-15')).toBe('2024-xx-15');
  });

  it('should_return_iso_string_when_date_constructor_overflows', function () {
    expect(formatAnalyticsChartDayLabel('8000000000-01-01')).toBe('8000000000-01-01');
  });

  it('should_format_valid_date_with_en_IN_locale', function () {
    const out = formatAnalyticsChartDayLabel('2024-06-15');
    expect(out).toMatch(/Jun/);
    expect(out).toMatch(/15/);
  });
});
