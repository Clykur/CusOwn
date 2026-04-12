import { Slot } from '@/types';
import {
  ERROR_MESSAGES,
  DAYS_TO_GENERATE_SLOTS,
  SLOT_STATUS,
  SLOT_GENERATION_WINDOW_DAYS,
  DEFAULT_CONCURRENT_BOOKING_CAPACITY,
  MAX_BOOKING_DURATION_MINUTES,
  MIN_BOOKING_DURATION_MINUTES,
} from '@/config/constants';
import { downtimeService } from './downtime.service';
import { slotTemplateCache, slotPoolManager, dateSlotOptimizer } from './slot-optimizer.service';
import {
  hasSlotsForDate,
  getExtendedOccupancyMinuteIntervalsForDate,
  getSlotsByIntervals,
  getSlotById,
  insertSlots,
  releaseExpiredReservationsForBusinessDate,
  releaseExpiredReservationsBatch,
  updateSlotStatus,
  setSlotReserved,
  releaseSlotReserved,
  setSlotBooked,
} from '@/repositories/slot.repository';
import { generateTimeSlots, normalizeTime, timeToMinutes } from '@/lib/utils/time';
import {
  canScheduleWithinCapacity,
  overlapsAnyBlocked,
  type MinuteInterval,
} from '@/lib/slot-capacity-timeline';
import { slotStateMachine } from '@/lib/state/slot-state-machine';
import { emitSlotReserved, emitSlotBooked, emitSlotReleased } from '@/lib/events/slot-events';
import { safeMetrics } from '@/lib/monitoring/safe-metrics';
import { auditService } from '@/services/audit.service';
import {
  buildQueryCacheKey,
  withQueryCache,
  invalidateSlotsCache,
  QUERY_CACHE_TTL,
  QUERY_CACHE_PREFIX,
} from '@/lib/cache/query-cache';

type SalonTimeConfig = {
  opening_time: string;
  closing_time: string;
  slot_duration: number;
  /** Max overlapping bookings (chairs); defaults to 1. */
  concurrent_booking_capacity?: number;
};

export type AvailableSlotsOptions = {
  skipCleanup?: boolean;
  /** Total appointment length in minutes; defaults to business slot_duration. */
  requestedDurationMinutes?: number;
  /** IST YYYY-MM-DD when applying "past slot" rules; omit to skip same-day past filter. */
  todayDateStringIST?: string;
  /** Minutes since midnight (IST) for today; used with todayDateStringIST. */
  nowMinutesIST?: number;
  /** Break / closure windows in minutes-from-midnight (half-open overlap check). */
  blockedIntervalsMin?: MinuteInterval[];
};

export class SlotService {
  async generateInitialSlots(salonId: string, config: SalonTimeConfig): Promise<void> {
    const today = new Date();
    const slotsToCreate: Array<Omit<Slot, 'id' | 'created_at'>> = [];

    for (let i = 0; i < DAYS_TO_GENERATE_SLOTS; i++) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + i);
      const dateString = targetDate.toISOString().split('T')[0];

      const isClosed = await downtimeService.isBusinessClosed(salonId, dateString);
      if (isClosed) {
        continue;
      }

      const dayOfWeek = targetDate.getDay();
      const specialHours = await downtimeService.getBusinessSpecialHours(salonId);
      const daySpecialHours = specialHours.find((sh) => sh.day_of_week === dayOfWeek);

      let openingTime = config.opening_time;
      let closingTime = config.closing_time;

      if (daySpecialHours) {
        if (daySpecialHours.is_closed) {
          continue;
        }
        if (daySpecialHours.opening_time) {
          openingTime = daySpecialHours.opening_time;
        }
        if (daySpecialHours.closing_time) {
          closingTime = daySpecialHours.closing_time;
        }
      }

      // Use optimized template cache (O(1) lookup for same config)
      const timeSlots = slotTemplateCache.getTemplate({
        opening_time: openingTime,
        closing_time: closingTime,
        slot_duration: config.slot_duration,
      });

      for (const timeSlot of timeSlots) {
        slotsToCreate.push({
          business_id: salonId,
          date: dateString,
          start_time: timeSlot.start,
          end_time: timeSlot.end,
          status: SLOT_STATUS.AVAILABLE,
        });
      }
    }

    if (slotsToCreate.length === 0) {
      return;
    }

    const BATCH_SIZE = 100;
    for (let i = 0; i < slotsToCreate.length; i += BATCH_SIZE) {
      const batch = slotsToCreate.slice(i, i + BATCH_SIZE);
      await insertSlots(batch);
    }
  }

  async generateSlotsForDate(
    salonId: string,
    date: string,
    config: SalonTimeConfig
  ): Promise<void> {
    if (!config.opening_time || !config.closing_time || !config.slot_duration) {
      throw new Error(
        'Invalid slot generation configuration: missing opening_time, closing_time, or slot_duration'
      );
    }

    const isClosed = await downtimeService.isBusinessClosed(salonId, date);
    if (isClosed) {
      return;
    }

    const exists = await hasSlotsForDate(salonId, date);
    if (exists) {
      return;
    }

    const dayOfWeek = new Date(date + 'T00:00:00').getDay();
    const specialHours = await downtimeService.getBusinessSpecialHours(salonId);
    const daySpecialHours = specialHours.find((sh) => sh.day_of_week === dayOfWeek);

    let openingTime = config.opening_time;
    let closingTime = config.closing_time;

    if (daySpecialHours) {
      if (daySpecialHours.is_closed) {
        return;
      }
      if (daySpecialHours.opening_time) {
        openingTime = daySpecialHours.opening_time;
      }
      if (daySpecialHours.closing_time) {
        closingTime = daySpecialHours.closing_time;
      }
    }

    // Use optimized template cache (O(1) lookup for same config)
    const timeSlots = slotTemplateCache.getTemplate({
      opening_time: openingTime,
      closing_time: closingTime,
      slot_duration: config.slot_duration,
    });

    if (timeSlots.length === 0) {
      return;
    }

    const slotsToCreate: Array<Omit<Slot, 'id' | 'created_at'>> = timeSlots.map((timeSlot) => ({
      business_id: salonId,
      date,
      start_time: timeSlot.start,
      end_time: timeSlot.end,
      status: SLOT_STATUS.AVAILABLE,
    }));

    await insertSlots(slotsToCreate);
  }

  async getAvailableSlots(
    salonId: string,
    date: string,
    salonConfig?: SalonTimeConfig,
    options?: AvailableSlotsOptions
  ): Promise<Slot[]> {
    const startTime = Date.now();
    const normalizedDate = date.includes('T') ? date.split('T')[0] : date;

    // Build cache key for slot availability
    const cacheKey = buildQueryCacheKey(`${QUERY_CACHE_PREFIX.SLOTS}${salonId}:`, normalizedDate, {
      skipCleanup: options?.skipCleanup,
    });

    return withQueryCache(cacheKey, QUERY_CACHE_TTL.SLOT_AVAILABILITY, async () => {
      return this._getAvailableSlotsUncached(salonId, normalizedDate, salonConfig, options);
    }).finally(() => {
      safeMetrics.recordTiming('slots.fetch', Date.now() - startTime);
    });
  }

  private async _getAvailableSlotsUncached(
    salonId: string,
    normalizedDate: string,
    salonConfig?: SalonTimeConfig,
    options?: AvailableSlotsOptions
  ): Promise<Slot[]> {
    const now = new Date();
    const nowIso = now.toISOString();

    const exists = await hasSlotsForDate(salonId, normalizedDate);
    if (!exists && salonConfig) {
      await slotPoolManager.queueGeneration(
        salonId,
        normalizedDate,
        salonConfig,
        async (bid, d, cfg) => {
          await this.generateSlotsForDate(bid, d, cfg);
        }
      );

      const missingDates = await dateSlotOptimizer.getMissingDates(
        salonId,
        normalizedDate,
        SLOT_GENERATION_WINDOW_DAYS,
        async (bid, d): Promise<boolean> => hasSlotsForDate(bid, d)
      );

      if (missingDates.length > 0) {
        const generationRequests = missingDates.map((d) => ({
          businessId: salonId,
          date: d,
          config: salonConfig,
        }));
        await slotPoolManager.batchGenerateSlots(generationRequests, async (bid, d, cfg) => {
          await slotPoolManager.queueGeneration(bid, d, cfg, async (b, dt, c) => {
            await this.generateSlotsForDate(b, dt, c);
          });
        });
      }
    }

    if (!salonConfig) {
      return [];
    }

    const grid = generateTimeSlots(
      salonConfig.opening_time,
      salonConfig.closing_time,
      salonConfig.slot_duration
    );
    if (grid.length === 0) {
      return [];
    }

    const requested = options?.requestedDurationMinutes ?? salonConfig.slot_duration;
    const duration = Math.floor(requested);
    if (duration < MIN_BOOKING_DURATION_MINUTES || duration > MAX_BOOKING_DURATION_MINUTES) {
      return [];
    }

    const capacity = salonConfig.concurrent_booking_capacity ?? DEFAULT_CONCURRENT_BOOKING_CAPACITY;

    const openMin = timeToMinutes(normalizeTime(salonConfig.opening_time));
    const closeMin = timeToMinutes(normalizeTime(salonConfig.closing_time));
    if (openMin >= closeMin || duration > closeMin - openMin) {
      return [];
    }

    const occupancy = await getExtendedOccupancyMinuteIntervalsForDate(
      salonId,
      normalizedDate,
      nowIso
    );

    const blocked = options?.blockedIntervalsMin ?? [];
    const todayStr = options?.todayDateStringIST;
    const nowMinIst = options?.nowMinutesIST;
    const isTodayFiltered =
      todayStr !== undefined && nowMinIst !== undefined && normalizedDate === todayStr;

    const passingGridCells: Array<{ start: string; end: string }> = [];

    for (const cell of grid) {
      const startMin = timeToMinutes(normalizeTime(cell.start));
      const appointmentEnd = startMin + duration;

      if (appointmentEnd > closeMin) {
        continue;
      }
      if (overlapsAnyBlocked(startMin, appointmentEnd, blocked)) {
        continue;
      }
      if (isTodayFiltered && startMin <= nowMinIst!) {
        continue;
      }
      if (!canScheduleWithinCapacity(occupancy, startMin, appointmentEnd, capacity)) {
        continue;
      }
      passingGridCells.push({ start: cell.start, end: cell.end });
    }

    if (passingGridCells.length === 0) {
      if (!options?.skipCleanup) {
        await releaseExpiredReservationsForBusinessDate(salonId, normalizedDate, nowIso);
      }
      return [];
    }

    let slotRows = await getSlotsByIntervals(salonId, normalizedDate, passingGridCells);

    if (!options?.skipCleanup) {
      await releaseExpiredReservationsForBusinessDate(salonId, normalizedDate, nowIso);
    }

    const processedSlots: Slot[] = [];
    for (const slot of slotRows) {
      processedSlots.push({
        ...slot,
        status: SLOT_STATUS.AVAILABLE,
        reserved_until: null,
      });
    }

    processedSlots.sort((a, b) => a.start_time.localeCompare(b.start_time));

    return processedSlots;
  }

  async getSlotById(slotId: string): Promise<Slot | null> {
    return getSlotById(slotId);
  }

  async updateSlotStatus(
    slotId: string,
    status: (typeof SLOT_STATUS)[keyof typeof SLOT_STATUS]
  ): Promise<void> {
    const slot = await getSlotById(slotId);
    if (!slot) {
      throw new Error(ERROR_MESSAGES.SLOT_NOT_FOUND);
    }
    await updateSlotStatus(slotId, slot.business_id, { status });
  }

  async reserveSlot(slotId: string): Promise<boolean> {
    const slot = await getSlotById(slotId);
    if (!slot) return false;

    if (!slotStateMachine.canTransition(slot.status, 'reserve')) {
      return false;
    }

    const now = new Date();
    if (slot.status === SLOT_STATUS.RESERVED && slot.reserved_until) {
      const reservedUntil = new Date(slot.reserved_until);
      if (reservedUntil > now) return false;
    }

    const { env } = await import('@/config/env');
    const reservedUntil = new Date();
    reservedUntil.setMinutes(reservedUntil.getMinutes() + env.payment.slotExpiryMinutes);

    const updated = await setSlotReserved(slotId, slot.business_id, reservedUntil.toISOString());
    if (!updated) return false;

    const nextState = slotStateMachine.getNextState(slot.status, 'reserve');
    if (nextState !== SLOT_STATUS.RESERVED) {
      await updateSlotStatus(slotId, slot.business_id, {
        status: slot.status,
        reserved_until: null,
      });
      return false;
    }

    const updatedSlot = await getSlotById(slotId);
    if (updatedSlot) {
      await emitSlotReserved(updatedSlot);
      // Invalidate slots cache after reservation
      void invalidateSlotsCache(slot.business_id, slot.date);
    }

    try {
      await auditService.createAuditLog(null, 'slot_reserved', 'slot', {
        entityId: slotId,
        description: `Slot reserved until ${reservedUntil.toISOString()}`,
      });
    } catch (auditError) {}

    return true;
  }

  async releaseSlot(slotId: string): Promise<void> {
    const slot = await getSlotById(slotId);
    if (!slot) return;

    if (!slotStateMachine.canTransition(slot.status, 'release')) {
      throw new Error(`Cannot release slot from ${slot.status} state`);
    }

    const nextState = slotStateMachine.getNextState(slot.status, 'release');
    if (nextState !== SLOT_STATUS.AVAILABLE) {
      throw new Error(`Invalid state transition: ${slot.status} -> ${nextState}`);
    }

    await releaseSlotReserved(slotId, slot.business_id);

    const updatedSlot = await getSlotById(slotId);
    if (updatedSlot) {
      await emitSlotReleased(updatedSlot);
      // Invalidate slots cache after release
      void invalidateSlotsCache(slot.business_id, slot.date);
      try {
        await auditService.createAuditLog(null, 'slot_released', 'slot', {
          entityId: slotId,
          description: `Slot released from ${slot.status} to available`,
        });
      } catch (auditError) {}
    }
  }

  /** Amortized cleanup: batch release expired reservations (for cron). No full table scan. */
  async releaseExpiredReservations(batchLimit = 500): Promise<number> {
    return releaseExpiredReservationsBatch(batchLimit);
  }

  async bookSlot(slotId: string): Promise<void> {
    const slot = await getSlotById(slotId);
    if (!slot) {
      throw new Error(ERROR_MESSAGES.SLOT_NOT_FOUND);
    }

    if (!slotStateMachine.canTransition(slot.status, 'book')) {
      throw new Error(`Cannot book slot from ${slot.status} state`);
    }

    const nextState = slotStateMachine.getNextState(slot.status, 'book');
    if (nextState !== SLOT_STATUS.BOOKED) {
      throw new Error(`Invalid state transition: ${slot.status} -> ${nextState}`);
    }

    await setSlotBooked(slotId, slot.business_id);

    const updatedSlot = await getSlotById(slotId);
    if (updatedSlot) {
      await emitSlotBooked(updatedSlot);
      // Invalidate slots cache after booking
      void invalidateSlotsCache(slot.business_id, slot.date);
      try {
        await auditService.createAuditLog(null, 'slot_booked', 'slot', {
          entityId: slotId,
          description: `Slot booked from ${slot.status}`,
        });
      } catch (auditError) {}
    }
  }

  async markSlotAsBooked(slotId: string): Promise<void> {
    return this.bookSlot(slotId);
  }
}

export const slotService = new SlotService();
