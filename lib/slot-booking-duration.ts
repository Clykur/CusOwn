/**
 * Total booking span in minutes from services + per-service buffer (prep/cleanup).
 */

import {
  DEFAULT_SERVICE_BOOKING_BUFFER_MINUTES,
  MAX_BOOKING_DURATION_MINUTES,
  MIN_BOOKING_DURATION_MINUTES,
} from '@/config/constants';

export type ServiceLike = { id: string; duration_minutes: number };

/**
 * Dedupe by service id (first occurrence wins), then sum duration + buffer per service.
 */
export function computeTotalBookingDurationMinutes(
  services: ServiceLike[],
  bufferMinutesPerService: number = DEFAULT_SERVICE_BOOKING_BUFFER_MINUTES
): number {
  if (!services.length) {
    return 0;
  }
  const seen = new Set<string>();
  let total = 0;
  for (const s of services) {
    if (seen.has(s.id)) {
      continue;
    }
    seen.add(s.id);
    const d = Number(s.duration_minutes);
    if (!Number.isFinite(d) || d <= 0) {
      return 0;
    }
    total += d + bufferMinutesPerService;
  }
  if (total < MIN_BOOKING_DURATION_MINUTES || total > MAX_BOOKING_DURATION_MINUTES) {
    return 0;
  }
  return Math.floor(total);
}
