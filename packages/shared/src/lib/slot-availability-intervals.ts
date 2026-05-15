/**
 * DSA-style availability: interval subtraction for slot availability.
 * O(n log n) merge + sweep; no nested O(n²). Used by getAvailableSlots.
 */

export type TimeInterval = { start: string; end: string };

/**
 * Merge overlapping or adjacent intervals. Input must be sorted by start.
 * O(n).
 */
function mergeIntervals(intervals: TimeInterval[]): TimeInterval[] {
  if (intervals.length <= 1) return intervals;
  const out: TimeInterval[] = [intervals[0]!];
  for (let i = 1; i < intervals.length; i++) {
    const cur = intervals[i]!;
    const last = out[out.length - 1]!;
    if (cur.start <= last.end) {
      if (cur.end > last.end) {
        last.end = cur.end;
      }
    } else {
      out.push({ ...cur });
    }
  }
  return out;
}

/**
 * Compare time strings "HH:MM:SS" lexicographically (valid for same-day times).
 */
function cmpTime(a: string, b: string): number {
  return a.localeCompare(b);
}

/**
 * Subtract occupied intervals from full-day intervals.
 * fullDay: sorted by start; occupied: will be sorted and merged.
 * Returns intervals in fullDay that do not overlap any occupied interval.
 * O(n log n) where n = fullDay.length + occupied.length.
 */
export function subtractOccupiedFromFullDay(
  fullDay: TimeInterval[],
  occupied: TimeInterval[]
): TimeInterval[] {
  if (occupied.length === 0) return fullDay;
  const sorted = [...occupied].sort((a, b) => cmpTime(a.start, b.start));
  const merged = mergeIntervals(sorted);
  const result: TimeInterval[] = [];
  for (const seg of fullDay) {
    let low = seg.start;
    const segEnd = seg.end;
    for (const occ of merged) {
      const occStart = occ.start;
      const occEnd = occ.end;
      if (occEnd <= low || occStart >= segEnd) continue;
      if (occStart > low) {
        result.push({ start: low, end: occStart < segEnd ? occStart : segEnd });
      }
      low = occEnd > low ? occEnd : low;
      if (low >= segEnd) break;
    }
    if (low < segEnd) {
      result.push({ start: low, end: segEnd });
    }
  }
  return result;
}
