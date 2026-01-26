import { supabaseAdmin } from '@/lib/supabase/server';
import { bookingService } from './booking.service';
import { slotService } from './slot.service';
import { ERROR_MESSAGES, BOOKING_STATUS, SLOT_STATUS } from '@/config/constants';
import { emitSlotReleased } from '@/lib/events/slot-events';

export interface MarkNoShowInput {
  bookingId: string;
  markedBy: 'owner' | 'system';
}

export class NoShowService {
  async markNoShow(input: MarkNoShowInput): Promise<any> {
    if (!supabaseAdmin) {
      throw new Error('Database not configured');
    }

    const booking = await bookingService.getBookingByUuidWithDetails(input.bookingId);
    if (!booking) {
      throw new Error(ERROR_MESSAGES.BOOKING_NOT_FOUND);
    }

    if (booking.status !== BOOKING_STATUS.CONFIRMED) {
      throw new Error('Only confirmed bookings can be marked as no-show');
    }

    if (booking.no_show) {
      throw new Error('Booking is already marked as no-show');
    }

    const { data: updatedBooking, error: updateError } = await supabaseAdmin
      .from('bookings')
      .update({
        no_show: true,
        no_show_marked_at: new Date().toISOString(),
        no_show_marked_by: input.markedBy,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.bookingId)
      .select()
      .single();

    if (updateError) {
      throw new Error(updateError.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    if (booking.slot) {
      await slotService.updateSlotStatus(booking.slot.id, SLOT_STATUS.AVAILABLE);
      await emitSlotReleased(booking.slot);
    }

    return updatedBooking;
  }

  async getNoShowAnalytics(businessId: string, startDate: string, endDate: string): Promise<{
    totalNoShows: number;
    noShowRate: number;
    noShowByDate: Array<{ date: string; count: number }>;
    noShowCustomers: Array<{ customerPhone: string; customerName: string; count: number }>;
  }> {
    if (!supabaseAdmin) {
      throw new Error('Database not configured');
    }

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select('id, customer_phone, customer_name, no_show_marked_at, slot_id')
      .eq('business_id', businessId)
      .eq('no_show', true)
      .gte('no_show_marked_at', startDate)
      .lte('no_show_marked_at', endDate);

    if (error) {
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    const noShows = data || [];
    const totalNoShows = noShows.length;

    const { data: confirmedBookings } = await supabaseAdmin
      .from('bookings')
      .select('id')
      .eq('business_id', businessId)
      .eq('status', BOOKING_STATUS.CONFIRMED)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    const confirmedCount = confirmedBookings?.length || 0;
    const noShowRate = confirmedCount > 0 ? (totalNoShows / confirmedCount) * 100 : 0;

    const dateMap = new Map<string, number>();
    noShows.forEach(ns => {
      if (ns.no_show_marked_at) {
        const date = new Date(ns.no_show_marked_at).toISOString().split('T')[0];
        dateMap.set(date, (dateMap.get(date) || 0) + 1);
      }
    });

    const noShowByDate = Array.from(dateMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const customerMap = new Map<string, { name: string; count: number }>();
    noShows.forEach(ns => {
      const phone = ns.customer_phone;
      const current = customerMap.get(phone) || { name: ns.customer_name || 'Unknown', count: 0 };
      customerMap.set(phone, { name: current.name, count: current.count + 1 });
    });

    const noShowCustomers = Array.from(customerMap.entries())
      .map(([customerPhone, data]) => ({
        customerPhone,
        customerName: data.name,
        count: data.count,
      }))
      .sort((a, b) => b.count - a.count);

    return {
      totalNoShows,
      noShowRate: Math.round(noShowRate * 100) / 100,
      noShowByDate,
      noShowCustomers,
    };
  }

  async getCustomerNoShowHistory(customerPhone: string, businessId?: string): Promise<any[]> {
    if (!supabaseAdmin) {
      throw new Error('Database not configured');
    }

    let query = supabaseAdmin
      .from('bookings')
      .select('id, business_id, booking_id, no_show_marked_at, slot_id')
      .eq('customer_phone', customerPhone)
      .eq('no_show', true)
      .order('no_show_marked_at', { ascending: false });

    if (businessId) {
      query = query.eq('business_id', businessId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    return data || [];
  }
}

export const noShowService = new NoShowService();
