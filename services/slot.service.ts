import { Slot } from '@/types';
import {
  ERROR_MESSAGES,
  DAYS_TO_GENERATE_SLOTS,
  SLOT_STATUS,
  SLOT_GENERATION_WINDOW_DAYS,
} from '@/config/constants';
import { downtimeService } from './downtime.service';
import { slotTemplateCache, slotPoolManager, dateSlotOptimizer } from './slot-optimizer.service';
import {
  hasSlotsForDate,
  getOccupiedIntervalsForDate,
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
import { generateTimeSlots } from '@/lib/utils/time';
import { subtractOccupiedFromFullDay } from '@/lib/slot-availability-intervals';

const INITIAL_SLOT_DAYS = DAYS_TO_GENERATE_SLOTS;
import { slotStateMachine } from '@/lib/state/slot-state-machine';
import { emitSlotReserved, emitSlotBooked, emitSlotReleased } from '@/lib/events/slot-events';
import { metricsService } from '@/lib/monitoring/metrics';
import { auditService } from '@/services/audit.service';

type SalonTimeConfig = {
  opening_time: string;
  closing_time: string;
  slot_duration: number;
};

export class SlotService {
  async generateInitialSlots(salonId: string, config: SalonTimeConfig): Promise<void> {
    const today = new Date();
    const slotsToCreate: Array<Omit<Slot, 'id' | 'created_at'>> = [];

    for (let i = 0; i < INITIAL_SLOT_DAYS; i++) {
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
    options?: { skipCleanup?: boolean }
  ): Promise<Slot[]> {
    const startTime = Date.now();
    const normalizedDate = date.includes('T') ? date.split('T')[0] : date;
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
      void metricsService.recordTiming('slots.fetch', Date.now() - startTime);
      return [];
    }

    const fullDayIntervals = generateTimeSlots(
      salonConfig.opening_time,
      salonConfig.closing_time,
      salonConfig.slot_duration
    );
    if (fullDayIntervals.length === 0) {
      void metricsService.recordTiming('slots.fetch', Date.now() - startTime);
      return [];
    }

    const occupied = await getOccupiedIntervalsForDate(salonId, normalizedDate, nowIso);
    const occupiedAsIntervals = occupied.map((o) => ({ start: o.start_time, end: o.end_time }));
    const availableIntervals = subtractOccupiedFromFullDay(fullDayIntervals, occupiedAsIntervals);
    let slotRows = await getSlotsByIntervals(salonId, normalizedDate, availableIntervals);

    if (!options?.skipCleanup) {
      await releaseExpiredReservationsForBusinessDate(salonId, normalizedDate, nowIso);
    }

    const todayDateString = now.toISOString().split('T')[0];
    const isToday = normalizedDate === todayDateString;

    const processedSlots: Slot[] = [];
    for (const slot of slotRows) {
      if (isToday) {
        const [hours, minutes] = slot.start_time.split(':').map(Number);
        const slotDateTime = new Date(now);
        slotDateTime.setHours(hours, minutes, 0, 0);
        if (now >= slotDateTime) continue;
      }
      processedSlots.push({
        ...slot,
        status: SLOT_STATUS.AVAILABLE,
        reserved_until: null,
      });
    }

    processedSlots.sort((a, b) => a.start_time.localeCompare(b.start_time));

    void metricsService.recordTiming('slots.fetch', Date.now() - startTime);
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
    if (updatedSlot) await emitSlotReserved(updatedSlot);

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
