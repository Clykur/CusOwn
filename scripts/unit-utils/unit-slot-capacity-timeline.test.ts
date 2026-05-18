/**
 * Unit tests: sweep-line capacity helpers (slot-capacity-timeline).
 */

import { describe, it, expect } from 'vitest';
import {
  maxConcurrentInWindow,
  canScheduleWithinCapacity,
  overlapsAnyBlocked,
  type MinuteInterval,
} from '@/lib/slot-capacity-timeline';

describe('slot-capacity-timeline', () => {
  it('maxConcurrentInWindow_counts_two_overlapping', () => {
    const intervals: MinuteInterval[] = [
      { startMin: 60, endMin: 120 },
      { startMin: 90, endMin: 150 },
    ];
    expect(maxConcurrentInWindow(intervals, 0, 200)).toBe(2);
  });

  it('maxConcurrentInWindow_respects_window_clip', () => {
    const intervals: MinuteInterval[] = [{ startMin: 60, endMin: 120 }];
    expect(maxConcurrentInWindow(intervals, 0, 90)).toBe(1);
    expect(maxConcurrentInWindow(intervals, 120, 180)).toBe(0);
  });

  it('canScheduleWithinCapacity_requires_strictly_less_than_capacity', () => {
    const intervals: MinuteInterval[] = [{ startMin: 100, endMin: 130 }];
    expect(canScheduleWithinCapacity(intervals, 100, 130, 2)).toBe(true);
    expect(canScheduleWithinCapacity(intervals, 100, 130, 1)).toBe(false);
  });

  it('overlapsAnyBlocked_detects_overlap', () => {
    const blocked: MinuteInterval[] = [{ startMin: 200, endMin: 230 }];
    expect(overlapsAnyBlocked(210, 220, blocked)).toBe(true);
    expect(overlapsAnyBlocked(180, 190, blocked)).toBe(false);
  });
});
