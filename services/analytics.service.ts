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
  peakHour: string | null;
  totalRevenueCents: number;
  averageTicketCents: number;
  services: { id: string; name: string; count: number; revenueCents: number }[];
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
  revenue: number;
}

export class AnalyticsService {
  private toIsoDate(value: string): string {
    return value.split('T')[0];
  }

  private normalizeBusinessIds(businessIds: string[]): string[] {
    return Array.from(new Set(businessIds.filter(Boolean)));
  }

  private applyBusinessScope(query: any, businessIds: string[]) {
    if (businessIds.length === 1) {
      return query.eq('business_id', businessIds[0]);
    }
    return query.in('business_id', businessIds);
  }

  async getBookingAnalytics(
    businessId: string,
    startDate: string,
    endDate: string
  ): Promise<BookingAnalytics> {
    return this.getBookingAnalyticsForBusinesses([businessId], startDate, endDate);
  }

  async getBookingAnalyticsForBusinesses(
    businessIds: string[],
    startDate: string,
    endDate: string
  ): Promise<BookingAnalytics> {
    if (!supabaseAdmin) {
      throw new Error('Database not configured');
    }

    const normalizedBusinessIds = this.normalizeBusinessIds(businessIds);
    if (normalizedBusinessIds.length === 0) {
      return {
        totalBookings: 0,
        confirmedBookings: 0,
        rejectedBookings: 0,
        cancelledBookings: 0,
        noShowCount: 0,
        conversionRate: 0,
        cancellationRate: 0,
        noShowRate: 0,
        peakHour: null,
        totalRevenueCents: 0,
        averageTicketCents: 0,
        services: [],
      };
    }

    let bookingsQuery = supabaseAdmin
      .from('bookings')
      .select('id, business_id, status, no_show, total_price_cents, slot_id, created_at');
    bookingsQuery = this.applyBusinessScope(bookingsQuery, normalizedBusinessIds);
    const { data, error } = await bookingsQuery
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (error) {
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    const bookings = data || [];
    const totalBookings = bookings.length;
    const confirmedBookings = bookings.filter((b) => b.status === 'confirmed').length;
    const rejectedBookings = bookings.filter((b) => b.status === 'rejected').length;
    const cancelledBookings = bookings.filter((b) => b.status === 'cancelled').length;
    const noShowCount = bookings.filter((b) => b.no_show === true).length;
    const confirmedList = bookings.filter((b) => b.status === 'confirmed');
    const totalRevenueCents = confirmedList.reduce(
      (sum, b) => sum + (typeof b.total_price_cents === 'number' ? b.total_price_cents : 0),
      0
    );
    const averageTicketCents =
      confirmedList.length > 0 ? Math.round(totalRevenueCents / confirmedList.length) : 0;

    const conversionRate = totalBookings > 0 ? (confirmedBookings / totalBookings) * 100 : 0;
    const cancellationRate = totalBookings > 0 ? (cancelledBookings / totalBookings) * 100 : 0;
    const noShowRate = confirmedBookings > 0 ? (noShowCount / confirmedBookings) * 100 : 0;

    // Peak hour from confirmed bookings' slots
    let peakHour: string | null = null;
    const slotIds = Array.from(
      new Set(
        confirmedList
          .map((b) => b.slot_id as string | null | undefined)
          .filter((id): id is string => !!id)
      )
    );
    if (slotIds.length > 0) {
      const { data: slots } = await supabaseAdmin
        .from('slots')
        .select('id, start_time')
        .in('id', slotIds);
      const slotHourMap = new Map<string, number>();
      (slots || []).forEach((s) => {
        const hour = new Date(s.start_time).getHours();
        slotHourMap.set(s.id, hour);
      });
      const hourCounts = new Map<number, number>();
      confirmedList.forEach((b) => {
        const h = slotHourMap.get(b.slot_id as string);
        if (h == null) return;
        hourCounts.set(h, (hourCounts.get(h) || 0) + 1);
      });
      let bestHour: number | null = null;
      let bestCount = -1;
      hourCounts.forEach((count, hour) => {
        if (count > bestCount) {
          bestCount = count;
          bestHour = hour;
        }
      });
      if (bestHour !== null) peakHour = `${String(bestHour).padStart(2, '0')}:00`;
    }

    // Service popularity for this owner's business in the selected date range
    let servicesQuery = supabaseAdmin
      .from('services')
      .select('id, name, business_id')
      .eq('is_active', true)
      .order('name', { ascending: true });
    servicesQuery = this.applyBusinessScope(servicesQuery, normalizedBusinessIds);
    const { data: servicesData } = await servicesQuery;
    const serviceMap = new Map<
      string,
      { id: string; name: string; count: number; revenueCents: number }
    >();
    (servicesData || []).forEach((s) => {
      serviceMap.set(s.id, { id: s.id, name: s.name, count: 0, revenueCents: 0 });
    });
    const bookingIds = bookings.map((b) => b.id as string);
    if (bookingIds.length > 0 && serviceMap.size > 0) {
      const { data: bookingServices } = await supabaseAdmin
        .from('booking_services')
        .select('service_id, price_cents')
        .in('booking_id', bookingIds);
      (bookingServices || []).forEach((bs) => {
        const row = serviceMap.get(bs.service_id as string);
        if (!row) return;
        row.count += 1;
        row.revenueCents += typeof bs.price_cents === 'number' ? bs.price_cents : 0;
      });
    }
    const servicesByBusiness = Array.from(serviceMap.values()).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name);
    });
    const services =
      normalizedBusinessIds.length > 1
        ? Array.from(
            servicesByBusiness
              .reduce((acc, service) => {
                const key = service.name.trim().toLowerCase();
                const current = acc.get(key) || {
                  id: `all:${key}`,
                  name: service.name,
                  count: 0,
                  revenueCents: 0,
                };
                current.count += service.count;
                current.revenueCents += service.revenueCents;
                acc.set(key, current);
                return acc;
              }, new Map<string, { id: string; name: string; count: number; revenueCents: number }>())
              .values()
          ).sort((a, b) => {
            if (b.count !== a.count) return b.count - a.count;
            return a.name.localeCompare(b.name);
          })
        : servicesByBusiness;

    return {
      totalBookings,
      confirmedBookings,
      rejectedBookings,
      cancelledBookings,
      noShowCount,
      conversionRate: Math.round(conversionRate * 100) / 100,
      cancellationRate: Math.round(cancellationRate * 100) / 100,
      noShowRate: Math.round(noShowRate * 100) / 100,
      peakHour,
      totalRevenueCents,
      averageTicketCents,
      services,
    };
  }

  async getDailyAnalytics(
    businessId: string,
    startDate: string,
    endDate: string
  ): Promise<DailyAnalytics[]> {
    return this.getDailyAnalyticsForBusinesses([businessId], startDate, endDate);
  }

  async getDailyAnalyticsForBusinesses(
    businessIds: string[],
    startDate: string,
    endDate: string
  ): Promise<DailyAnalytics[]> {
    if (!supabaseAdmin) {
      throw new Error('Database not configured');
    }

    const normalizedBusinessIds = this.normalizeBusinessIds(businessIds);
    if (normalizedBusinessIds.length === 0) {
      return [];
    }

    let dailyQuery = supabaseAdmin.from('booking_analytics_daily').select('*');
    dailyQuery = this.applyBusinessScope(dailyQuery, normalizedBusinessIds);
    const { data, error } = await dailyQuery
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (error) {
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    let bookingsQuery = supabaseAdmin
      .from('bookings')
      .select('created_at, status, total_price_cents');
    bookingsQuery = this.applyBusinessScope(bookingsQuery, normalizedBusinessIds);
    const { data: bookingsData, error: bookingsError } = await bookingsQuery
      .gte('created_at', startDate)
      .lte('created_at', endDate);
    if (bookingsError) {
      throw new Error(bookingsError.message || ERROR_MESSAGES.DATABASE_ERROR);
    }
    const revenueByDate = new Map<string, number>();
    (bookingsData || []).forEach((b) => {
      if (b.status !== 'confirmed') return;
      const key = this.toIsoDate(b.created_at as string);
      const current = revenueByDate.get(key) || 0;
      revenueByDate.set(
        key,
        current + (typeof b.total_price_cents === 'number' ? b.total_price_cents : 0)
      );
    });

    const dailyTotals = new Map<string, Omit<DailyAnalytics, 'revenue'>>();
    (data || []).forEach((item) => {
      const current = dailyTotals.get(item.date) || {
        date: item.date,
        totalBookings: 0,
        confirmedBookings: 0,
        rejectedBookings: 0,
        cancelledBookings: 0,
        noShowCount: 0,
      };
      current.totalBookings += item.total_bookings || 0;
      current.confirmedBookings += item.confirmed_bookings || 0;
      current.rejectedBookings += item.rejected_bookings || 0;
      current.cancelledBookings += item.cancelled_bookings || 0;
      current.noShowCount += item.no_show_count || 0;
      dailyTotals.set(item.date, current);
    });

    const allDates = Array.from(new Set([...dailyTotals.keys(), ...revenueByDate.keys()])).sort();
    return allDates.map((date) => {
      const current = dailyTotals.get(date) || {
        date,
        totalBookings: 0,
        confirmedBookings: 0,
        rejectedBookings: 0,
        cancelledBookings: 0,
        noShowCount: 0,
      };
      return {
        ...current,
        revenue: Math.round(((revenueByDate.get(date) || 0) / 100) * 100) / 100,
      };
    });
  }

  async getPeakHours(
    businessId: string,
    startDate: string,
    endDate: string
  ): Promise<PeakHoursData[]> {
    return this.getPeakHoursForBusinesses([businessId], startDate, endDate);
  }

  async getPeakHoursForBusinesses(
    businessIds: string[],
    startDate: string,
    endDate: string
  ): Promise<PeakHoursData[]> {
    if (!supabaseAdmin) {
      throw new Error('Database not configured');
    }

    const normalizedBusinessIds = this.normalizeBusinessIds(businessIds);
    if (normalizedBusinessIds.length === 0) {
      return [];
    }

    let peakHoursQuery = supabaseAdmin.from('booking_analytics_hourly').select('*');
    peakHoursQuery = this.applyBusinessScope(peakHoursQuery, normalizedBusinessIds);
    const { data, error } = await peakHoursQuery
      .gte('date', startDate)
      .lte('date', endDate)
      .order('hour', { ascending: true });

    if (error) {
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    const hourlyMap = new Map<number, number>();

    (data || []).forEach((item) => {
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
    return this.getCustomerRetentionForBusinesses([businessId]);
  }

  async getCustomerRetentionForBusinesses(businessIds: string[]): Promise<CustomerRetentionData[]> {
    if (!supabaseAdmin) {
      throw new Error('Database not configured');
    }

    const normalizedBusinessIds = this.normalizeBusinessIds(businessIds);
    if (normalizedBusinessIds.length === 0) {
      return [];
    }

    let retentionQuery = supabaseAdmin.from('customer_retention').select('*');
    retentionQuery = this.applyBusinessScope(retentionQuery, normalizedBusinessIds);
    const { data, error } = await retentionQuery
      .order('total_bookings', { ascending: false })
      .limit(500);

    if (error) {
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    const customerPhones = new Set((data || []).map((item) => item.customer_phone));
    const phoneArray = Array.from(customerPhones);

    if (phoneArray.length === 0) {
      return [];
    }

    const totalsByPhone = new Map<
      string,
      {
        customerPhone: string;
        bookingDays: number;
        totalBookings: number;
        lastBookingAt: string;
        firstBookingAt: string;
      }
    >();
    (data || []).forEach((item) => {
      const phone = item.customer_phone as string;
      const current = totalsByPhone.get(phone) || {
        customerPhone: phone,
        bookingDays: 0,
        totalBookings: 0,
        lastBookingAt: item.last_booking_at as string,
        firstBookingAt: item.first_booking_at as string,
      };
      current.bookingDays += item.booking_days || 0;
      current.totalBookings += item.total_bookings || 0;
      if (new Date(item.last_booking_at).getTime() > new Date(current.lastBookingAt).getTime()) {
        current.lastBookingAt = item.last_booking_at;
      }
      if (new Date(item.first_booking_at).getTime() < new Date(current.firstBookingAt).getTime()) {
        current.firstBookingAt = item.first_booking_at;
      }
      totalsByPhone.set(phone, current);
    });

    let bookingsQuery = supabaseAdmin
      .from('bookings')
      .select('customer_phone, customer_name, created_at');
    bookingsQuery = this.applyBusinessScope(bookingsQuery, normalizedBusinessIds);
    const { data: bookingsData } = await bookingsQuery.in('customer_phone', phoneArray);

    const nameMap = new Map<string, { name: string; createdAt: string }>();
    (bookingsData || []).forEach((booking) => {
      const phone = booking.customer_phone as string;
      const current = nameMap.get(phone);
      if (
        !current ||
        new Date(booking.created_at).getTime() > new Date(current.createdAt).getTime()
      ) {
        nameMap.set(phone, {
          name: (booking.customer_name as string) || 'Unknown',
          createdAt: booking.created_at as string,
        });
      }
    });

    return Array.from(totalsByPhone.values())
      .map((row) => ({
        customerPhone: row.customerPhone,
        customerName: nameMap.get(row.customerPhone)?.name || 'Unknown',
        bookingDays: row.bookingDays,
        totalBookings: row.totalBookings,
        lastBookingAt: row.lastBookingAt,
        firstBookingAt: row.firstBookingAt,
      }))
      .sort((a, b) => b.totalBookings - a.totalBookings)
      .slice(0, 100);
  }

  async exportAnalyticsCSV(
    businessId: string,
    startDate: string,
    endDate: string
  ): Promise<string> {
    return this.exportAnalyticsCSVForBusinesses([businessId], startDate, endDate);
  }

  async exportAnalyticsCSVForBusinesses(
    businessIds: string[],
    startDate: string,
    endDate: string
  ): Promise<string> {
    const analytics = await this.getDailyAnalyticsForBusinesses(businessIds, startDate, endDate);

    const headers = ['Date', 'Total Bookings', 'Confirmed', 'Rejected', 'Cancelled', 'No Shows'];
    const rows = analytics.map((a) => [
      a.date,
      a.totalBookings.toString(),
      a.confirmedBookings.toString(),
      a.rejectedBookings.toString(),
      a.cancelledBookings.toString(),
      a.noShowCount.toString(),
    ]);

    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

    return csv;
  }
}

export const analyticsService = new AnalyticsService();
