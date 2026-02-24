import { supabaseAdmin } from '@/lib/supabase/server';
import { Slot } from '@/types';
import {
  ERROR_MESSAGES,
  DAYS_TO_GENERATE_SLOTS,
  SLOT_STATUS,
  SLOT_GENERATION_WINDOW_DAYS,
} from '@/config/constants';
import { downtimeService } from './downtime.service';
import { slotTemplateCache, slotPoolManager, dateSlotOptimizer } from './slot-optimizer.service';

// Ensure we're using the constant
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
      console.warn(`No slots to create for business ${salonId} - check time configuration`);
      return;
    }

    if (!supabaseAdmin) {
      throw new Error('Database not configured');
    }

    // Insert slots in batches to avoid overwhelming the database
    const BATCH_SIZE = 100;
    for (let i = 0; i < slotsToCreate.length; i += BATCH_SIZE) {
      const batch = slotsToCreate.slice(i, i + BATCH_SIZE);
      const { error } = await supabaseAdmin.from('slots').insert(batch);

      if (error) {
        console.error(`Error inserting slot batch ${i / BATCH_SIZE + 1}:`, error);
        throw new Error(error.message || ERROR_MESSAGES.SLOT_GENERATION_FAILED);
      }
    }

    console.log(
      `✅ Generated ${slotsToCreate.length} slots for business ${salonId} (${INITIAL_SLOT_DAYS} days)`
    );
  }

  async generateSlotsForDate(
    salonId: string,
    date: string,
    config: SalonTimeConfig
  ): Promise<void> {
    if (!supabaseAdmin) {
      throw new Error('Database not configured');
    }

    // Validate config
    if (!config.opening_time || !config.closing_time || !config.slot_duration) {
      console.error('Invalid slot generation config:', { salonId, date, config });
      throw new Error(
        'Invalid slot generation configuration: missing opening_time, closing_time, or slot_duration'
      );
    }

    const isClosed = await downtimeService.isBusinessClosed(salonId, date);
    if (isClosed) {
      console.log(`Business ${salonId} is closed on ${date}, skipping slot generation`);
      return;
    }

    const { data: existing } = await supabaseAdmin
      .from('slots')
      .select('id')
      .eq('business_id', salonId)
      .eq('date', date)
      .limit(1);

    if (existing && existing.length > 0) {
      return;
    }

    const dayOfWeek = new Date(date + 'T00:00:00').getDay();
    const specialHours = await downtimeService.getBusinessSpecialHours(salonId);
    const daySpecialHours = specialHours.find((sh) => sh.day_of_week === dayOfWeek);

    let openingTime = config.opening_time;
    let closingTime = config.closing_time;

    if (daySpecialHours) {
      if (daySpecialHours.is_closed) {
        console.log(
          `Business ${salonId} is closed on day ${dayOfWeek} (${date}), skipping slot generation`
        );
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
      console.warn(`No slots generated for ${salonId} on ${date}`, {
        openingTime,
        closingTime,
        slotDuration: config.slot_duration,
      });
      return;
    }

    const slotsToCreate: Array<Omit<Slot, 'id' | 'created_at'>> = timeSlots.map((timeSlot) => ({
      business_id: salonId,
      date,
      start_time: timeSlot.start,
      end_time: timeSlot.end,
      status: SLOT_STATUS.AVAILABLE,
    }));

    if (!supabaseAdmin) {
      throw new Error('Database not configured');
    }

    // Insert slots - ensure they're actually written to database
    const { error, data } = await supabaseAdmin.from('slots').insert(slotsToCreate).select('id');

    if (error) {
      console.error('Error inserting slots:', error);
      throw new Error(error.message || ERROR_MESSAGES.SLOT_GENERATION_FAILED);
    }

    if (!data || data.length === 0) {
      console.error('No slots were inserted despite no error');
      throw new Error('Slot insertion failed - no data returned');
    }

    console.log(
      `✅ Generated ${slotsToCreate.length} slots for ${salonId} on ${date} (${data.length} inserted)`
    );
  }

  async getAvailableSlots(
    salonId: string,
    date: string,
    salonConfig?: SalonTimeConfig,
    options?: { skipCleanup?: boolean }
  ): Promise<Slot[]> {
    const startTime = Date.now();

    if (!supabaseAdmin) {
      throw new Error('Database not configured');
    }

    // Normalize date format (ensure YYYY-MM-DD)
    const normalizedDate = date.includes('T') ? date.split('T')[0] : date;

    const { data: existingSlots } = await supabaseAdmin
      .from('slots')
      .select('id')
      .eq('business_id', salonId)
      .eq('date', normalizedDate)
      .limit(1);

    if ((!existingSlots || existingSlots.length === 0) && salonConfig) {
      // Use queue manager to avoid duplicate concurrent generations
      await slotPoolManager.queueGeneration(
        salonId,
        normalizedDate,
        salonConfig,
        async (bid, date, cfg) => {
          await this.generateSlotsForDate(bid, date, cfg);
        }
      );

      // Optimize future date generation - only generate missing dates
      if (!supabaseAdmin) {
        throw new Error('Database not configured');
      }
      const missingDates = await dateSlotOptimizer.getMissingDates(
        salonId,
        normalizedDate,
        SLOT_GENERATION_WINDOW_DAYS,
        async (bid, date): Promise<boolean> => {
          if (!supabaseAdmin) {
            return false;
          }
          const { data } = await supabaseAdmin
            .from('slots')
            .select('id')
            .eq('business_id', bid)
            .eq('date', date)
            .limit(1);
          return !!(data && data.length > 0);
        }
      );

      // Batch generate missing dates using pool manager
      if (missingDates.length > 0) {
        const generationRequests = missingDates.map((date) => ({
          businessId: salonId,
          date,
          config: salonConfig,
        }));

        await slotPoolManager.batchGenerateSlots(generationRequests, async (bid, date, cfg) => {
          await slotPoolManager.queueGeneration(bid, date, cfg, async (b, d, c) => {
            await this.generateSlotsForDate(b, d, c);
          });
        });

        console.log(
          `✅ Generated slots for ${missingDates.length} future dates: ${missingDates.join(', ')}`
        );
      }
    }

    if (!options?.skipCleanup) {
      await this.releaseExpiredReservations();
    }

    const { data, error } = await supabaseAdmin
      .from('slots')
      .select('id, business_id, date, start_time, end_time, status, reserved_until, created_at')
      .eq('business_id', salonId)
      .eq('date', normalizedDate)
      .order('start_time', { ascending: true });

    if (error) {
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    const now = new Date();
    const todayDateString = now.toISOString().split('T')[0];
    const isToday = normalizedDate === todayDateString;

    // Process and filter slots
    const processedSlots: Slot[] = [];

    for (const slot of data || []) {
      // For today's slots, check if slot time has passed
      let isPast = false;
      if (isToday) {
        const [hours, minutes] = slot.start_time.split(':').map(Number);
        const slotDateTime = new Date(now);
        slotDateTime.setHours(hours, minutes, 0, 0);

        // If current time is >= slot start time, the slot has passed
        isPast = now >= slotDateTime;
      }

      // Handle expired reservations (convert to available)
      if (slot.status === SLOT_STATUS.RESERVED) {
        if (!slot.reserved_until) {
          // Invalid reservation, treat as available
          slot.status = SLOT_STATUS.AVAILABLE;
          slot.reserved_until = null;
        } else {
          const reservedUntil = new Date(slot.reserved_until);
          if (reservedUntil <= now) {
            // Reservation expired, treat as available
            slot.status = SLOT_STATUS.AVAILABLE;
            slot.reserved_until = null;
          }
        }
      }

      // For today, exclude past slots (except booked ones which we show as disabled)
      if (isToday && isPast && slot.status !== SLOT_STATUS.BOOKED) {
        continue; // Skip past slots (but keep booked slots for display)
      }

      processedSlots.push(slot);
    }

    void metricsService.recordTiming('slots.fetch', Date.now() - startTime);
    return processedSlots;
  }

  async getSlotById(slotId: string): Promise<Slot | null> {
    if (!supabaseAdmin) {
      throw new Error('Database not configured');
    }
    const { data, error } = await supabaseAdmin
      .from('slots')
      .select('id, business_id, date, start_time, end_time, status, reserved_until, created_at')
      .eq('id', slotId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    return data;
  }

  async updateSlotStatus(
    slotId: string,
    status: (typeof SLOT_STATUS)[keyof typeof SLOT_STATUS]
  ): Promise<void> {
    if (!supabaseAdmin) {
      throw new Error('Database not configured');
    }
    const slot = await this.getSlotById(slotId);
    if (!slot) {
      throw new Error(ERROR_MESSAGES.SLOT_NOT_FOUND);
    }

    const { error } = await supabaseAdmin.from('slots').update({ status }).eq('id', slotId);

    if (error) {
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }
  }

  async reserveSlot(slotId: string): Promise<boolean> {
    if (!supabaseAdmin) {
      throw new Error('Database not configured');
    }

    // Get slot with current status
    const slot = await this.getSlotById(slotId);
    if (!slot) {
      return false;
    }

    // Check if transition is allowed
    if (!slotStateMachine.canTransition(slot.status, 'reserve')) {
      return false;
    }

    // Check if slot is actually available (handle expired reservations)
    const now = new Date();
    if (slot.status === SLOT_STATUS.RESERVED && slot.reserved_until) {
      const reservedUntil = new Date(slot.reserved_until);
      if (reservedUntil > now) {
        // Still reserved, cannot reserve again
        return false;
      }
      // Reservation expired, treat as available
    }

    const { env } = await import('@/config/env');
    const reservedUntil = new Date();
    reservedUntil.setMinutes(reservedUntil.getMinutes() + env.payment.slotExpiryMinutes);

    // Build update query - only update if slot is available or has expired reservation
    let updateQuery = supabaseAdmin
      .from('slots')
      .update({
        status: SLOT_STATUS.RESERVED,
        reserved_until: reservedUntil.toISOString(),
      })
      .eq('id', slotId);

    // Add condition based on current status
    if (slot.status === SLOT_STATUS.AVAILABLE) {
      // Only update if still available (atomic check)
      updateQuery = updateQuery.eq('status', SLOT_STATUS.AVAILABLE);
    } else if (slot.status === SLOT_STATUS.RESERVED && slot.reserved_until) {
      // Only update if reservation has expired
      const now = new Date().toISOString();
      updateQuery = updateQuery.eq('status', SLOT_STATUS.RESERVED).lt('reserved_until', now);
    } else {
      // Invalid state, cannot reserve
      return false;
    }

    const { data: updatedSlot, error } = await updateQuery.select().single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows updated - slot was already changed by another process
        return false;
      }
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    if (!updatedSlot || updatedSlot.status !== SLOT_STATUS.RESERVED) {
      return false;
    }

    const nextState = slotStateMachine.getNextState(slot.status, 'reserve');
    if (nextState !== SLOT_STATUS.RESERVED) {
      await supabaseAdmin
        .from('slots')
        .update({ status: slot.status, reserved_until: null })
        .eq('id', slotId);
      return false;
    }

    await emitSlotReserved(updatedSlot);

    try {
      await auditService.createAuditLog(null, 'slot_reserved', 'slot', {
        entityId: slotId,
        description: `Slot reserved until ${reservedUntil.toISOString()}`,
      });
    } catch (auditError) {
      console.error('[AUDIT] Failed to log slot reservation:', auditError);
    }

    return true;
  }

  async releaseSlot(slotId: string): Promise<void> {
    const slot = await this.getSlotById(slotId);
    if (!slot) return;

    if (!slotStateMachine.canTransition(slot.status, 'release')) {
      throw new Error(`Cannot release slot from ${slot.status} state`);
    }

    if (!supabaseAdmin) {
      throw new Error('Database not configured');
    }

    const nextState = slotStateMachine.getNextState(slot.status, 'release');
    if (nextState !== SLOT_STATUS.AVAILABLE) {
      throw new Error(`Invalid state transition: ${slot.status} -> ${nextState}`);
    }

    const { error } = await supabaseAdmin
      .from('slots')
      .update({
        status: SLOT_STATUS.AVAILABLE,
        reserved_until: null,
      })
      .eq('id', slotId)
      .in('status', [SLOT_STATUS.RESERVED, SLOT_STATUS.BOOKED]);

    if (error) {
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    const updatedSlot = await this.getSlotById(slotId);
    if (updatedSlot) {
      await emitSlotReleased(updatedSlot);

      try {
        await auditService.createAuditLog(null, 'slot_released', 'slot', {
          entityId: slotId,
          description: `Slot released from ${slot.status} to available`,
        });
      } catch (auditError) {
        console.error('[AUDIT] Failed to log slot release:', auditError);
      }
    }
  }

  async releaseExpiredReservations(): Promise<number> {
    if (!supabaseAdmin) {
      throw new Error('Database not configured');
    }
    const now = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from('slots')
      .update({
        status: SLOT_STATUS.AVAILABLE,
        reserved_until: null,
      })
      .eq('status', SLOT_STATUS.RESERVED)
      .lt('reserved_until', now)
      .select('id');

    if (error) {
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    return data?.length || 0;
  }

  async bookSlot(slotId: string): Promise<void> {
    const slot = await this.getSlotById(slotId);
    if (!slot) {
      throw new Error(ERROR_MESSAGES.SLOT_NOT_FOUND);
    }

    if (!slotStateMachine.canTransition(slot.status, 'book')) {
      throw new Error(`Cannot book slot from ${slot.status} state`);
    }

    if (!supabaseAdmin) {
      throw new Error('Database not configured');
    }

    const nextState = slotStateMachine.getNextState(slot.status, 'book');
    if (nextState !== SLOT_STATUS.BOOKED) {
      throw new Error(`Invalid state transition: ${slot.status} -> ${nextState}`);
    }

    const { error } = await supabaseAdmin
      .from('slots')
      .update({
        status: SLOT_STATUS.BOOKED,
        reserved_until: null,
      })
      .eq('id', slotId)
      .in('status', [SLOT_STATUS.RESERVED]);

    if (error) {
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    const updatedSlot = await this.getSlotById(slotId);
    if (updatedSlot) {
      await emitSlotBooked(updatedSlot);

      try {
        await auditService.createAuditLog(null, 'slot_booked', 'slot', {
          entityId: slotId,
          description: `Slot booked from ${slot.status}`,
        });
      } catch (auditError) {
        console.error('[AUDIT] Failed to log slot booking:', auditError);
      }
    }
  }

  async markSlotAsBooked(slotId: string): Promise<void> {
    return this.bookSlot(slotId);
  }
}

export const slotService = new SlotService();
