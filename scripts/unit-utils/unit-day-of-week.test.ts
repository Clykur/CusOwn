/**
 * Unit tests: lib/utils/day-of-week
 */
import { describe, expect, it } from 'vitest';
import { DAY_NAME_TO_JS, dayNameToJsDay } from '@/lib/utils/day-of-week';

describe('day-of-week', function () {
  it('should_map_all_day_names_in_DAY_NAME_TO_JS', function () {
    expect(DAY_NAME_TO_JS.sunday).toBe(0);
    expect(DAY_NAME_TO_JS.saturday).toBe(6);
  });

  it('should_return_js_day_for_lowercase_name', function () {
    expect(dayNameToJsDay('monday')).toBe(1);
  });

  it('should_trim_and_lowercase_before_lookup', function () {
    expect(dayNameToJsDay('  Tuesday  ')).toBe(2);
  });

  it('should_return_null_for_unknown_name', function () {
    expect(dayNameToJsDay('funday')).toBeNull();
  });

  it('should_return_null_for_empty_after_trim', function () {
    expect(dayNameToJsDay('   ')).toBeNull();
  });
});
