import { requireSupabaseAdmin } from '@/lib/supabase/server';
import { generateSlug, generateUniqueId, formatPhoneNumber } from '@/lib/utils/string';
import { CreateSalonInput, Salon } from '@/types';
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '@/config/constants';
import { slotService } from './slot.service';
import { cache } from 'react';

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
        city: data.city || null,
        area: data.area || null,
        pincode: data.pincode || null,
        latitude: data.latitude || null,
        longitude: data.longitude || null,
        owner_user_id: ownerUserId || null,
        category: data.category || 'salon',
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    if (!salon) {
      throw new Error(ERROR_MESSAGES.DATABASE_ERROR);
    }

    // Generate slots immediately when business is created
    // This ensures slots are available right away
    try {
      await slotService.generateInitialSlots(salon.id, {
        opening_time: salon.opening_time,
        closing_time: salon.closing_time,
        slot_duration: salon.slot_duration,
      });
      console.log(
        `✅ Slots generated for new business: ${salon.salon_name} (${salon.id.substring(0, 8)}...)`
      );
    } catch (slotError) {
      // Log error but don't fail business creation
      // Slots can be generated lazily later via getAvailableSlots
      console.error(`⚠️  Failed to generate initial slots for business ${salon.id}:`, slotError);
      console.error('Slots will be generated lazily when requested');
    }

    // QR code will be generated asynchronously via API route
    // This prevents blocking the salon creation if QR generation is slow

    return salon;
  }

  getSalonByBookingLink = cache(async (bookingLink: string): Promise<Salon | null> => {
    const supabaseAdmin = requireSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('businesses')
      .select(
        'id, salon_name, owner_name, whatsapp_number, opening_time, closing_time, slot_duration, booking_link, address, location, category, qr_code, owner_user_id, created_at, updated_at'
      )
      .eq('booking_link', bookingLink)
      .eq('suspended', false)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    return data;
  });

  getSalonById = cache(async (salonId: string, includeSuspended = false): Promise<Salon | null> => {
    const supabaseAdmin = requireSupabaseAdmin();
    let query = supabaseAdmin
      .from('businesses')
      .select(
        'id, salon_name, owner_name, whatsapp_number, opening_time, closing_time, slot_duration, booking_link, address, location, category, qr_code, owner_user_id, created_at, updated_at'
      )
      .eq('id', salonId);

    if (!includeSuspended) {
      query = query.eq('suspended', false);
    }

    const { data, error } = await query.single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    return data;
  });
}

export const salonService = new SalonService();
