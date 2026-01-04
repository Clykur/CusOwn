import { supabaseAdmin } from '@/lib/supabase/server';
import { generateTimeSlots } from '@/lib/utils/time';
import { Slot } from '@/types';
import {
  ERROR_MESSAGES,
  DAYS_TO_GENERATE_SLOTS,
  SLOT_STATUS,
  SLOT_RESERVATION_TIMEOUT_MINUTES,
  SLOT_GENERATION_WINDOW_DAYS,
} from '@/config/constants';

type SalonTimeConfig = {
  opening_time: string;
  closing_time: string;
  slot_duration: number;
};

export class SlotService {
  async generateInitialSlots(salonId: string, config: SalonTimeConfig): Promise<void> {
    const today = new Date();
    const slotsToCreate: Array<Omit<Slot, 'id' | 'created_at'>> = [];

    for (let i = 0; i < DAYS_TO_GENERATE_SLOTS; i++) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + i);
      const dateString = targetDate.toISOString().split('T')[0];

      const timeSlots = generateTimeSlots(
        config.opening_time,
        config.closing_time,
        config.slot_duration
      );

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

    if (!supabaseAdmin) {
      throw new Error('Database not configured');
    }
    const { error } = await supabaseAdmin.from('slots').insert(slotsToCreate);

    if (error) {
      throw new Error(error.message || ERROR_MESSAGES.SLOT_GENERATION_FAILED);
    }
  }

  async generateSlotsForDate(salonId: string, date: string, config: SalonTimeConfig): Promise<void> {
    if (!supabaseAdmin) {
      throw new Error('Database not configured');
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

    const timeSlots = generateTimeSlots(
      config.opening_time,
      config.closing_time,
      config.slot_duration
    );

    const slotsToCreate: Array<Omit<Slot, 'id' | 'created_at'>> = timeSlots.map((timeSlot) => ({
      business_id: salonId,
      date,
      start_time: timeSlot.start,
      end_time: timeSlot.end,
      status: SLOT_STATUS.AVAILABLE,
    }));

    if (slotsToCreate.length === 0) {
      return;
    }

    if (!supabaseAdmin) {
      throw new Error('Database not configured');
    }
    const { error } = await supabaseAdmin.from('slots').insert(slotsToCreate);

    if (error) {
      throw new Error(error.message || ERROR_MESSAGES.SLOT_GENERATION_FAILED);
    }
  }

  async getAvailableSlots(
    salonId: string,
    date: string,
    salonConfig?: SalonTimeConfig,
    options?: { skipCleanup?: boolean }
  ): Promise<Slot[]> {
    if (!supabaseAdmin) {
      throw new Error('Database not configured');
    }
    // First, check if slots exist for this date
    const { data: existingSlots } = await supabaseAdmin
      .from('slots')
      .select('id')
      .eq('business_id', salonId)
      .eq('date', date)
      .limit(1);

    // Lazy generation: If no slots exist and config provided, generate them
    if ((!existingSlots || existingSlots.length === 0) && salonConfig) {
      await this.generateSlotsForDate(salonId, date, salonConfig);
      
      // Also generate slots for the next few days to maintain a window
      const today = new Date(date);
      for (let i = 1; i <= SLOT_GENERATION_WINDOW_DAYS; i++) {
        const futureDate = new Date(today);
        futureDate.setDate(today.getDate() + i);
        const futureDateString = futureDate.toISOString().split('T')[0];
        
        const { data: futureSlots } = await supabaseAdmin
          .from('slots')
          .select('id')
          .eq('business_id', salonId)
          .eq('date', futureDateString)
          .limit(1);
        
        if (!futureSlots || futureSlots.length === 0) {
          await this.generateSlotsForDate(salonId, futureDateString, salonConfig);
        }
      }
    }

    // Clean up expired reservations before fetching (skip if requested for performance)
    if (!options?.skipCleanup) {
      await this.releaseExpiredReservations();
    }

    // Fetch all slots for the date (including booked slots for display)
    const { data, error } = await supabaseAdmin
      .from('slots')
      .select('*')
      .eq('business_id', salonId)
      .eq('date', date)
      .order('start_time', { ascending: true });

    if (error) {
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    const now = new Date();
    const todayDateString = now.toISOString().split('T')[0];
    const isToday = date === todayDateString;

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

    return processedSlots;
  }

  async getSlotById(slotId: string): Promise<Slot | null> {
    if (!supabaseAdmin) {
      throw new Error('Database not configured');
    }
    const { data, error } = await supabaseAdmin
      .from('slots')
      .select('*')
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

  async updateSlotStatus(slotId: string, status: typeof SLOT_STATUS[keyof typeof SLOT_STATUS]): Promise<void> {
    if (!supabaseAdmin) {
      throw new Error('Database not configured');
    }
    const { error } = await supabaseAdmin
      .from('slots')
      .update({ status })
      .eq('id', slotId);

    if (error) {
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }
  }

  async reserveSlot(slotId: string): Promise<boolean> {
    // First, check if slot is available
    const slot = await this.getSlotById(slotId);
    if (!slot) {
      throw new Error(ERROR_MESSAGES.SLOT_NOT_FOUND);
    }

    // Check if slot is already booked
    if (slot.status === SLOT_STATUS.BOOKED) {
      throw new Error(ERROR_MESSAGES.SLOT_NOT_AVAILABLE);
    }

    // Check if slot is reserved and not expired
    if (slot.status === SLOT_STATUS.RESERVED && slot.reserved_until) {
      const reservedUntil = new Date(slot.reserved_until);
      if (reservedUntil > new Date()) {
        throw new Error(ERROR_MESSAGES.SLOT_NOT_AVAILABLE);
      }
    }

    // Reserve the slot
    if (!supabaseAdmin) {
      throw new Error('Database not configured');
    }
    const reservedUntil = new Date();
    reservedUntil.setMinutes(reservedUntil.getMinutes() + SLOT_RESERVATION_TIMEOUT_MINUTES);

    const { error } = await supabaseAdmin
      .from('slots')
      .update({
        status: SLOT_STATUS.RESERVED,
        reserved_until: reservedUntil.toISOString(),
      })
      .eq('id', slotId)
      .eq('status', SLOT_STATUS.AVAILABLE);

    if (error) {
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    // Verify the update succeeded (check if row was actually updated)
    const updatedSlot = await this.getSlotById(slotId);
    return updatedSlot?.status === SLOT_STATUS.RESERVED;
  }

  async releaseSlot(slotId: string): Promise<void> {
    if (!supabaseAdmin) {
      throw new Error('Database not configured');
    }
    const { error } = await supabaseAdmin
      .from('slots')
      .update({
        status: SLOT_STATUS.AVAILABLE,
        reserved_until: null,
      })
      .eq('id', slotId)
      .in('status', [SLOT_STATUS.RESERVED]);

    if (error) {
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
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

  async markSlotAsBooked(slotId: string): Promise<void> {
    if (!supabaseAdmin) {
      throw new Error('Database not configured');
    }
    const { error } = await supabaseAdmin
      .from('slots')
      .update({
        status: SLOT_STATUS.BOOKED,
        reserved_until: null,
      })
      .eq('id', slotId);

    if (error) {
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }
  }
}

export const slotService = new SlotService();

