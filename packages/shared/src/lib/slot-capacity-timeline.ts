/**
 * Sweep-line concurrency for half-open [start, end) minute intervals.
 * Used for multi-chair capacity: a candidate fits iff max overlapping existing < capacity.
 */

export type MinuteInterval = { startMin: number; endMin: number };

/**
 * Max concurrent occupancy at any instant inside [windowStart, windowEnd) (half-open).
 * Clips each interval to the window and sweeps; O(k log k) for k overlapping intervals.
 */
export function maxConcurrentInWindow(
  intervals: MinuteInterval[],
  windowStart: number,
  windowEnd: number
): number {
  if (windowEnd <= windowStart) {
    return 0;
  }

  type Ev = { t: number; d: number };
  const ev: Ev[] = [];

  for (const iv of intervals) {
    const a = iv.startMin;
    const b = iv.endMin;
    if (b <= a) {
      continue;
    }
    if (b <= windowStart || a >= windowEnd) {
      continue;
    }
    const s = Math.max(a, windowStart);
    const e = Math.min(b, windowEnd);
    if (e <= s) {
      continue;
    }
    ev.push({ t: s, d: 1 });
    ev.push({ t: e, d: -1 });
  }

  ev.sort((x, y) => (x.t !== y.t ? x.t - y.t : x.d - y.d));

  let cur = 0;
  let max = 0;
  for (const e of ev) {
    cur += e.d;
    if (cur > max) {
      max = cur;
    }
  }
  return max;
}

/**
 * True if this booking window fits without exceeding capacity (existing only).
 */
export function canScheduleWithinCapacity(
  occupancy: MinuteInterval[],
  windowStart: number,
  windowEnd: number,
  capacity: number
): boolean {
  if (capacity < 1) {
    return false;
  }
  if (windowEnd <= windowStart) {
    return false;
  }
  return maxConcurrentInWindow(occupancy, windowStart, windowEnd) < capacity;
}

/**
 * Half-open overlap: [a0,a1) intersects [b0,b1).
 */
export function intervalsOverlapHalfOpen(a0: number, a1: number, b0: number, b1: number): boolean {
  return a0 < b1 && a1 > b0;
}

/**
 * True if [start,end) overlaps any blocked interval (half-open).
 */
export function overlapsAnyBlocked(
  startMin: number,
  endMin: number,
  blocked: MinuteInterval[]
): boolean {
  for (const b of blocked) {
    if (intervalsOverlapHalfOpen(startMin, endMin, b.startMin, b.endMin)) {
      return true;
    }
  }
  return false;
}
