import { requireSupabaseAdmin } from '@/lib/supabase/server';
import { ERROR_MESSAGES } from '@/config/constants';

export type BusinessHoliday = {
  id: string;
  business_id: string;
  holiday_date: string;
  holiday_name?: string | null;
  created_at: string;
};

export type BusinessClosure = {
  id: string;
  business_id: string;
  start_date: string;
  end_date: string;
  reason?: string | null;
  created_at: string;
  updated_at: string;
};

export type BusinessSpecialHours = {
  id: string;
  business_id: string;
  day_of_week: number;
  opening_time?: string | null;
  closing_time?: string | null;
  is_closed: boolean;
  created_at: string;
  updated_at: string;
};

export class DowntimeService {
  async addHoliday(businessId: string, holidayDate: string, holidayName?: string): Promise<BusinessHoliday> {
    const supabaseAdmin = requireSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('business_holidays')
      .insert({
        business_id: businessId,
        holiday_date: holidayDate,
        holiday_name: holidayName || null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }
    if (!data) {
      throw new Error(ERROR_MESSAGES.DATABASE_ERROR);
    }
    return data;
  }

  async removeHoliday(holidayId: string): Promise<void> {
    const supabaseAdmin = requireSupabaseAdmin();
    const { error } = await supabaseAdmin
      .from('business_holidays')
      .delete()
      .eq('id', holidayId);

    if (error) {
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }
  }

  async getBusinessHolidays(businessId: string): Promise<BusinessHoliday[]> {
    const supabaseAdmin = requireSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('business_holidays')
      .select('*')
      .eq('business_id', businessId)
      .order('holiday_date', { ascending: true });

    if (error) {
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }
    return data || [];
  }

  async addClosure(businessId: string, startDate: string, endDate: string, reason?: string): Promise<BusinessClosure> {
    const supabaseAdmin = requireSupabaseAdmin();
    if (new Date(endDate) < new Date(startDate)) {
      throw new Error(ERROR_MESSAGES.DOWNTIME_DATE_INVALID);
    }

    const { data, error } = await supabaseAdmin
      .from('business_closures')
      .insert({
        business_id: businessId,
        start_date: startDate,
        end_date: endDate,
        reason: reason || null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }
    if (!data) {
      throw new Error(ERROR_MESSAGES.DATABASE_ERROR);
    }
    return data;
  }

  async removeClosure(closureId: string): Promise<void> {
    const supabaseAdmin = requireSupabaseAdmin();
    const { error } = await supabaseAdmin
      .from('business_closures')
      .delete()
      .eq('id', closureId);

    if (error) {
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }
  }

  async getBusinessClosures(businessId: string): Promise<BusinessClosure[]> {
    const supabaseAdmin = requireSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('business_closures')
      .select('*')
      .eq('business_id', businessId)
      .order('start_date', { ascending: true });

    if (error) {
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }
    return data || [];
  }

  async setSpecialHours(businessId: string, dayOfWeek: number, openingTime?: string, closingTime?: string, isClosed: boolean = false): Promise<BusinessSpecialHours> {
    const supabaseAdmin = requireSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('business_special_hours')
      .upsert({
        business_id: businessId,
        day_of_week: dayOfWeek,
        opening_time: openingTime || null,
        closing_time: closingTime || null,
        is_closed: isClosed,
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }
    if (!data) {
      throw new Error(ERROR_MESSAGES.DATABASE_ERROR);
    }
    return data;
  }

  async getBusinessSpecialHours(businessId: string): Promise<BusinessSpecialHours[]> {
    const supabaseAdmin = requireSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('business_special_hours')
      .select('*')
      .eq('business_id', businessId)
      .order('day_of_week', { ascending: true });

    if (error) {
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }
    return data || [];
  }

  async isBusinessClosed(businessId: string, date: string): Promise<boolean> {
    const holidays = await this.getBusinessHolidays(businessId);
    const closures = await this.getBusinessClosures(businessId);
    const checkDate = new Date(date);

    const isHoliday = holidays.some(h => h.holiday_date === date);
    if (isHoliday) return true;

    const isInClosure = closures.some(c => {
      const start = new Date(c.start_date);
      const end = new Date(c.end_date);
      return checkDate >= start && checkDate <= end;
    });
    if (isInClosure) return true;

    const dayOfWeek = checkDate.getDay();
    const specialHours = await this.getBusinessSpecialHours(businessId);
    const daySpecialHours = specialHours.find(sh => sh.day_of_week === dayOfWeek);
    if (daySpecialHours?.is_closed) return true;

    return false;
  }
}

export const downtimeService = new DowntimeService();
