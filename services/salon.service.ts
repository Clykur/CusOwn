import { requireSupabaseAdmin } from '@/lib/supabase/server';
import { generateSlug, generateUniqueId, formatPhoneNumber } from '@/lib/utils/string';
import { CreateSalonInput, Salon } from '@/types';
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '@/config/constants';
import { slotService } from './slot.service';

export class SalonService {
  async createSalon(data: CreateSalonInput, ownerUserId?: string): Promise<Salon> {
    const supabaseAdmin = requireSupabaseAdmin();
    
    let bookingLink = generateSlug(data.salon_name);
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      const { data: existing } = await supabaseAdmin
        .from('businesses')
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

    // Format phone number with +91 if not already present
    const formattedPhone = formatPhoneNumber(data.whatsapp_number);

    const { data: salon, error } = await supabaseAdmin
      .from('businesses')
      .insert({
        salon_name: data.salon_name,
        owner_name: data.owner_name,
        whatsapp_number: formattedPhone,
        opening_time: data.opening_time,
        closing_time: data.closing_time,
        slot_duration: Number(data.slot_duration),
        booking_link: bookingLink,
        address: data.address,
        location: data.location || null,
        owner_user_id: ownerUserId || null, // Link to authenticated user if available
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    if (!salon) {
      throw new Error(ERROR_MESSAGES.DATABASE_ERROR);
    }

    // QR code will be generated asynchronously via API route
    // This prevents blocking the salon creation if QR generation is slow

    await slotService.generateInitialSlots(salon.id, {
      opening_time: salon.opening_time,
      closing_time: salon.closing_time,
      slot_duration: salon.slot_duration,
    });

    // Return salon (QR code will be added by API route)
    return salon;
  }

  async getSalonByBookingLink(bookingLink: string): Promise<Salon | null> {
    const supabaseAdmin = requireSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('businesses')
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
    const supabaseAdmin = requireSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('businesses')
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

