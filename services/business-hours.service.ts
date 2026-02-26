// /services/business-hours.service.ts

import { requireSupabaseAdmin } from '@/lib/supabase/server';
import { getISTDate, getISTDateString, toMinutes } from '@/lib/time/ist';

export class BusinessHoursService {
  private supabase = requireSupabaseAdmin();

  async getEffectiveHours(businessId: string, date: string) {
    // 1️⃣ Check holiday override
    const { data: holiday } = await this.supabase
      .from('business_holidays')
      .select('*')
      .eq('business_id', businessId)
      .eq('holiday_date', date)
      .maybeSingle();

    if (holiday) {
      if (holiday.is_closed) {
        return {
          isClosed: true,
          isHoliday: true,
          holidayName: holiday.holiday_name || null,
        };
      }

      // If holiday override exists but times are missing, treat as not configured
      if (!holiday.opening_time || !holiday.closing_time) {
        return null;
      }

      return {
        isClosed: false,
        isHoliday: true,
        holidayName: holiday.holiday_name || null,
        opening_time: holiday.opening_time,
        closing_time: holiday.closing_time,
        break_start_time: null,
        break_end_time: null,
      };
    }

    // 2️⃣ Weekly hours
    const dayOfWeek = new Date(date + 'T00:00:00').getDay();

    const { data: weekly } = await this.supabase
      .from('business_special_hours')
      .select('*')
      .eq('business_id', businessId)
      .eq('day_of_week', dayOfWeek)
      .single();

    if (!weekly) return null;

    if (weekly.is_closed) {
      return { isClosed: true };
    }

    // If weekly hours exist but times are missing, treat as not configured
    if (!weekly.opening_time || !weekly.closing_time) {
      return null;
    }

    return {
      isClosed: false,
      opening_time: weekly.opening_time,
      closing_time: weekly.closing_time,
      break_start_time: weekly.break_start_time,
      break_end_time: weekly.break_end_time,
    };
  }

  async validateSlot(
    businessId: string,
    slotDate: string,
    startTime: string,
    endTime: string
  ): Promise<{ valid: boolean; reason?: string }> {
    const todayStr = getISTDateString();
    const now = getISTDate();

    if (slotDate < todayStr) {
      return { valid: false, reason: 'Cannot book past date' };
    }

    const hours = await this.getEffectiveHours(businessId, slotDate);
    if (!hours) return { valid: false, reason: 'Business hours not configured' };
    if (hours.isClosed) return { valid: false, reason: 'Business closed on this day' };

    if (!hours.opening_time || !hours.closing_time) {
      return { valid: false, reason: 'Business hours not fully configured' };
    }

    const slotStart = toMinutes(startTime);
    const slotEnd = toMinutes(endTime);
    const open = toMinutes(hours.opening_time);
    const close = toMinutes(hours.closing_time);

    if (slotStart < open || slotEnd > close) {
      return { valid: false, reason: 'Outside business hours' };
    }

    // Break validation
    if (hours.break_start_time && hours.break_end_time) {
      const breakStart = toMinutes(hours.break_start_time);
      const breakEnd = toMinutes(hours.break_end_time);

      const overlapsBreak = slotStart < breakEnd && slotEnd > breakStart;

      if (overlapsBreak) {
        return { valid: false, reason: 'Overlaps break time' };
      }
    }

    // Today time validation
    if (slotDate === todayStr) {
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      if (currentMinutes >= close) {
        return { valid: false, reason: 'Shop closed for today' };
      }

      if (slotStart <= currentMinutes) {
        return { valid: false, reason: 'Slot already passed' };
      }
    }

    return { valid: true };
  }
}

export const businessHoursService = new BusinessHoursService();
