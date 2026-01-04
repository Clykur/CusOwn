import { supabaseAdmin } from '@/lib/supabase/server';
import { generateSlug, generateUniqueId } from '@/lib/utils/string';
import { CreateSalonInput, Salon } from '@/types';
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '@/config/constants';
import { slotService } from './slot.service';

export class SalonService {
  async createSalon(data: CreateSalonInput): Promise<Salon> {
    let bookingLink = generateSlug(data.salon_name);
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      const { data: existing } = await supabaseAdmin
        .from('salons')
        .select('id')
        .eq('booking_link', bookingLink)
        .single();

      if (!existing) {
        isUnique = true;
      } else {
        bookingLink = `${generateSlug(data.salon_name)}-${generateUniqueId().toLowerCase()}`;
        attempts++;
      }
    }

    if (!isUnique) {
      throw new Error(ERROR_MESSAGES.BOOKING_LINK_EXISTS);
    }

    const { data: salon, error } = await supabaseAdmin
      .from('salons')
      .insert({
        salon_name: data.salon_name,
        owner_name: data.owner_name,
        whatsapp_number: data.whatsapp_number,
        opening_time: data.opening_time,
        closing_time: data.closing_time,
        slot_duration: Number(data.slot_duration),
        booking_link: bookingLink,
        address: data.address || null,
        location: data.location || null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    if (!salon) {
      throw new Error(ERROR_MESSAGES.DATABASE_ERROR);
    }

    await slotService.generateInitialSlots(salon.id, {
      opening_time: salon.opening_time,
      closing_time: salon.closing_time,
      slot_duration: salon.slot_duration,
    });

    return salon;
  }

  async getSalonByBookingLink(bookingLink: string): Promise<Salon | null> {
    const { data, error } = await supabaseAdmin
      .from('salons')
      .select('*')
      .eq('booking_link', bookingLink)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    return data;
  }

  async getSalonById(salonId: string): Promise<Salon | null> {
    const { data, error } = await supabaseAdmin
      .from('salons')
      .select('*')
      .eq('id', salonId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    return data;
  }
}

export const salonService = new SalonService();

