import { supabaseAdmin } from '@/lib/supabase/server';
import { ERROR_MESSAGES } from '@/config/constants';

export interface BookingAnalytics {
  totalBookings: number;
  confirmedBookings: number;
  rejectedBookings: number;
  cancelledBookings: number;
  noShowCount: number;
  conversionRate: number;
  cancellationRate: number;
  noShowRate: number;
}

export interface PeakHoursData {
  hour: number;
  bookingCount: number;
  date: string;
}

export interface CustomerRetentionData {
  customerPhone: string;
  customerName: string;
  bookingDays: number;
  totalBookings: number;
  lastBookingAt: string;
  firstBookingAt: string;
}

export interface DailyAnalytics {
  date: string;
  totalBookings: number;
  confirmedBookings: number;
  rejectedBookings: number;
  cancelledBookings: number;
  noShowCount: number;
}

export class AnalyticsService {
  async getBookingAnalytics(
    businessId: string,
    startDate: string,
    endDate: string
  ): Promise<BookingAnalytics> {
    if (!supabaseAdmin) {
      throw new Error('Database not configured');
    }

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select('status, no_show')
      .eq('business_id', businessId)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (error) {
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    const bookings = data || [];
    const totalBookings = bookings.length;
    const confirmedBookings = bookings.filter(b => b.status === 'confirmed').length;
    const rejectedBookings = bookings.filter(b => b.status === 'rejected').length;
    const cancelledBookings = bookings.filter(b => b.status === 'cancelled').length;
    const noShowCount = bookings.filter(b => b.no_show === true).length;

    const conversionRate = totalBookings > 0 ? (confirmedBookings / totalBookings) * 100 : 0;
    const cancellationRate = totalBookings > 0 ? (cancelledBookings / totalBookings) * 100 : 0;
    const noShowRate = confirmedBookings > 0 ? (noShowCount / confirmedBookings) * 100 : 0;

    return {
      totalBookings,
      confirmedBookings,
      rejectedBookings,
      cancelledBookings,
      noShowCount,
      conversionRate: Math.round(conversionRate * 100) / 100,
      cancellationRate: Math.round(cancellationRate * 100) / 100,
      noShowRate: Math.round(noShowRate * 100) / 100,
    };
  }

  async getDailyAnalytics(
    businessId: string,
    startDate: string,
    endDate: string
  ): Promise<DailyAnalytics[]> {
    if (!supabaseAdmin) {
      throw new Error('Database not configured');
    }

    const { data, error } = await supabaseAdmin
      .from('booking_analytics_daily')
      .select('*')
      .eq('business_id', businessId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (error) {
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    return (data || []).map(item => ({
      date: item.date,
      totalBookings: item.total_bookings || 0,
      confirmedBookings: item.confirmed_bookings || 0,
      rejectedBookings: item.rejected_bookings || 0,
      cancelledBookings: item.cancelled_bookings || 0,
      noShowCount: item.no_show_count || 0,
    }));
  }

  async getPeakHours(
    businessId: string,
    startDate: string,
    endDate: string
  ): Promise<PeakHoursData[]> {
    if (!supabaseAdmin) {
      throw new Error('Database not configured');
    }

    const { data, error } = await supabaseAdmin
      .from('booking_analytics_hourly')
      .select('*')
      .eq('business_id', businessId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('hour', { ascending: true });

    if (error) {
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    const hourlyMap = new Map<number, number>();

    (data || []).forEach(item => {
      const hour = item.hour;
      const current = hourlyMap.get(hour) || 0;
      hourlyMap.set(hour, current + (item.booking_count || 0));
    });

    return Array.from(hourlyMap.entries())
      .map(([hour, bookingCount]) => ({
        hour,
        bookingCount,
        date: '',
      }))
      .sort((a, b) => a.hour - b.hour);
  }

  async getCustomerRetention(businessId: string): Promise<CustomerRetentionData[]> {
    if (!supabaseAdmin) {
      throw new Error('Database not configured');
    }

    const { data, error } = await supabaseAdmin
      .from('customer_retention')
      .select('*')
      .eq('business_id', businessId)
      .order('total_bookings', { ascending: false })
      .limit(100);

    if (error) {
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    const customerPhones = new Set((data || []).map(item => item.customer_phone));
    const phoneArray = Array.from(customerPhones);

    if (phoneArray.length === 0) {
      return [];
    }

    const { data: bookingsData } = await supabaseAdmin
      .from('bookings')
      .select('customer_phone, customer_name')
      .eq('business_id', businessId)
      .in('customer_phone', phoneArray);

    const nameMap = new Map<string, string>();
    (bookingsData || []).forEach(b => {
      if (!nameMap.has(b.customer_phone)) {
        nameMap.set(b.customer_phone, b.customer_name);
      }
    });

    return (data || []).map(item => ({
      customerPhone: item.customer_phone,
      customerName: nameMap.get(item.customer_phone) || 'Unknown',
      bookingDays: item.booking_days || 0,
      totalBookings: item.total_bookings || 0,
      lastBookingAt: item.last_booking_at,
      firstBookingAt: item.first_booking_at,
    }));
  }

  async exportAnalyticsCSV(
    businessId: string,
    startDate: string,
    endDate: string
  ): Promise<string> {
    const analytics = await this.getDailyAnalytics(businessId, startDate, endDate);

    const headers = ['Date', 'Total Bookings', 'Confirmed', 'Rejected', 'Cancelled', 'No Shows'];
    const rows = analytics.map(a => [
      a.date,
      a.totalBookings.toString(),
      a.confirmedBookings.toString(),
      a.rejectedBookings.toString(),
      a.cancelledBookings.toString(),
      a.noShowCount.toString(),
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');

    return csv;
  }
}

export const analyticsService = new AnalyticsService();
