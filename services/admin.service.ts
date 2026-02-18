import { supabaseAdmin } from '@/lib/supabase/server';
import { requireSupabaseAdmin } from '@/lib/supabase/server';
import { formatPhoneNumber } from '@/lib/utils/string';

export interface PlatformMetrics {
  totalBusinesses: number;
  activeBusinesses: number;
  suspendedBusinesses: number;
  totalOwners: number;
  totalCustomers: number;
  totalBookings: number;
  confirmedBookings: number;
  rejectedBookings: number;
  pendingBookings: number;
  cancelledBookings: number;
  bookingsToday: number;
  bookingsThisWeek: number;
  bookingsThisMonth: number;
  growthRate: {
    businesses: number;
    bookings: number;
    owners: number;
  };
}

export interface BusinessWithOwner {
  owner?: {
    id: string;
    email: string;
    full_name: string | null;
    user_type: string;
  } | null;
  bookingCount?: number;
  recentBookings?: any[];
}

export class AdminService {
  async getPlatformMetrics(): Promise<PlatformMetrics> {
    const supabase = requireSupabaseAdmin();

    // Total businesses
    const { count: totalBusinesses } = await supabase
      .from('businesses')
      .select('*', { count: 'exact', head: true });

    // Active businesses (not suspended)
    const { count: activeBusinesses } = await supabase
      .from('businesses')
      .select('*', { count: 'exact', head: true })
      .eq('suspended', false);

    // Suspended businesses
    const { count: suspendedBusinesses } = await supabase
      .from('businesses')
      .select('*', { count: 'exact', head: true })
      .eq('suspended', true);

    // Total owners
    const { count: totalOwners } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .in('user_type', ['owner', 'both', 'admin']);

    // Total customers
    const { count: totalCustomers } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .in('user_type', ['customer', 'both']);

    // Total bookings
    const { count: totalBookings } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true });

    // Confirmed bookings
    const { count: confirmedBookings } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'confirmed');

    // Rejected bookings
    const { count: rejectedBookings } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'rejected');

    // Pending bookings
    const { count: pendingBookings } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    // Cancelled bookings
    const { count: cancelledBookings } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'cancelled');

    // Bookings today
    const today = new Date().toISOString().split('T')[0];
    const { count: bookingsToday } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${today}T00:00:00Z`);

    // Bookings this week
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const { count: bookingsThisWeek } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', weekAgo.toISOString());

    // Bookings this month
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    const { count: bookingsThisMonth } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', monthAgo.toISOString());

    // Growth calculations (last 30 days vs previous 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const { count: businessesLast30 } = await supabase
      .from('businesses')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', thirtyDaysAgo.toISOString());

    const { count: businessesPrev30 } = await supabase
      .from('businesses')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', sixtyDaysAgo.toISOString())
      .lt('created_at', thirtyDaysAgo.toISOString());

    const { count: bookingsLast30 } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', thirtyDaysAgo.toISOString());

    const { count: bookingsPrev30 } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', sixtyDaysAgo.toISOString())
      .lt('created_at', thirtyDaysAgo.toISOString());

    const { count: ownersLast30 } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .in('user_type', ['owner', 'both', 'admin'])
      .gte('created_at', thirtyDaysAgo.toISOString());

    const { count: ownersPrev30 } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .in('user_type', ['owner', 'both', 'admin'])
      .gte('created_at', sixtyDaysAgo.toISOString())
      .lt('created_at', thirtyDaysAgo.toISOString());

    const calculateGrowthRate = (current: number, previous: number): number => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    return {
      totalBusinesses: totalBusinesses || 0,
      activeBusinesses: activeBusinesses || 0,
      suspendedBusinesses: suspendedBusinesses || 0,
      totalOwners: totalOwners || 0,
      totalCustomers: totalCustomers || 0,
      totalBookings: totalBookings || 0,
      confirmedBookings: confirmedBookings || 0,
      rejectedBookings: rejectedBookings || 0,
      pendingBookings: pendingBookings || 0,
      cancelledBookings: cancelledBookings || 0,
      bookingsToday: bookingsToday || 0,
      bookingsThisWeek: bookingsThisWeek || 0,
      bookingsThisMonth: bookingsThisMonth || 0,
      growthRate: {
        businesses: calculateGrowthRate(businessesLast30 || 0, businessesPrev30 || 0),
        bookings: calculateGrowthRate(bookingsLast30 || 0, bookingsPrev30 || 0),
        owners: calculateGrowthRate(ownersLast30 || 0, ownersPrev30 || 0),
      },
    };
  }

  async getAllBusinesses(): Promise<BusinessWithOwner[]> {
    const supabase = requireSupabaseAdmin();

    const { data: businesses, error } = await supabase
      .from('businesses')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch businesses: ${error.message}`);
    }

    if (!businesses) return [];

    // Get owner information for each business
    const businessesWithOwners = await Promise.all(
      businesses.map(async (business) => {
        let owner = null;
        if (business.owner_user_id) {
          const { data: ownerData } = await supabase
            .from('user_profiles')
            .select('id, user_type, full_name')
            .eq('id', business.owner_user_id)
            .single();

          if (ownerData) {
            const { data: authUser } = await supabase.auth.admin.getUserById(
              business.owner_user_id
            );
            owner = {
              id: ownerData.id,
              email: authUser?.user?.email || '',
              full_name: ownerData.full_name,
              user_type: ownerData.user_type,
            };
          }
        }

        // Get booking count
        const { count: bookingCount } = await supabase
          .from('bookings')
          .select('*', { count: 'exact', head: true })
          .eq('business_id', business.id);

        // Get recent bookings
        const { data: recentBookings } = await supabase
          .from('bookings')
          .select('id, customer_name, status, created_at')
          .eq('business_id', business.id)
          .order('created_at', { ascending: false })
          .limit(5);

        return {
          ...business,
          owner,
          bookingCount: bookingCount || 0,
          recentBookings: recentBookings || [],
        };
      })
    );

    return businessesWithOwners;
  }

  async getAllUsers(): Promise<any[]> {
    const supabase = requireSupabaseAdmin();

    const { data: profiles, error } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch users: ${error.message}`);
    }

    if (!profiles) return [];

    // Get auth user info and businesses for each profile
    const usersWithDetails = await Promise.all(
      profiles.map(async (profile) => {
        const { data: authUser } = await supabase.auth.admin.getUserById(profile.id);

        const { data: businesses } = await supabase
          .from('businesses')
          .select('id, salon_name, booking_link')
          .eq('owner_user_id', profile.id);

        const { count: bookingCount } = await supabase
          .from('bookings')
          .select('*', { count: 'exact', head: true })
          .eq('customer_user_id', profile.id);

        return {
          ...profile,
          email: authUser?.user?.email || '',
          businesses: businesses || [],
          bookingCount: bookingCount || 0,
        };
      })
    );

    return usersWithDetails;
  }

  async getAllBookings(filters?: {
    businessId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    const supabase = requireSupabaseAdmin();

    let query = supabase
      .from('bookings')
      .select(
        `
        *,
        business:business_id (
          id,
          salon_name,
          owner_name,
          whatsapp_number,
          address,
          location,
          owner_user_id
        ),
        slot:slot_id (
          id,
          date,
          start_time,
          end_time,
          status
        )
      `
      )
      .order('created_at', { ascending: false });

    if (filters?.businessId) {
      query = query.eq('business_id', filters.businessId);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch bookings: ${error.message}`);
    }

    return data || [];
  }

  async getBookingTrends(days: number = 30): Promise<any[]> {
    const supabase = requireSupabaseAdmin();

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('created_at, status')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch booking trends: ${error.message}`);
    }

    if (!bookings) return [];

    // Group by date
    const trends: {
      [key: string]: { date: string; total: number; confirmed: number; rejected: number };
    } = {};

    bookings.forEach((booking) => {
      const date = booking.created_at.split('T')[0];
      if (!trends[date]) {
        trends[date] = { date, total: 0, confirmed: 0, rejected: 0 };
      }
      trends[date].total++;
      if (booking.status === 'confirmed') trends[date].confirmed++;
      if (booking.status === 'rejected') trends[date].rejected++;
    });

    return Object.values(trends).sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Paginated bookings for export: id, booking_id, status, created_at, business_id, business name.
   * Date range and optional business_id filter; index-friendly.
   */
  async getBookingsForExport(filters: {
    startDate: string;
    endDate: string;
    businessId?: string;
    limit: number;
    offset: number;
  }): Promise<
    {
      id: string;
      booking_id: string;
      status: string;
      created_at: string;
      business_id: string;
      business_name: string;
    }[]
  > {
    const supabase = requireSupabaseAdmin();
    let query = supabase
      .from('bookings')
      .select('id, booking_id, status, created_at, business_id')
      .gte('created_at', filters.startDate)
      .lte('created_at', filters.endDate)
      .order('created_at', { ascending: true })
      .range(filters.offset, filters.offset + filters.limit - 1);

    if (filters.businessId) {
      query = query.eq('business_id', filters.businessId);
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(`Failed to fetch bookings: ${error.message}`);
    if (!rows?.length) return [];

    const businessIds = [...new Set(rows.map((r) => r.business_id))];
    const { data: businesses } = await supabase
      .from('businesses')
      .select('id, salon_name')
      .in('id', businessIds);
    const nameMap = new Map((businesses || []).map((b) => [b.id, b.salon_name ?? '']));

    return rows.map((r) => ({
      id: r.id,
      booking_id: r.booking_id,
      status: r.status,
      created_at: r.created_at,
      business_id: r.business_id,
      business_name: nameMap.get(r.business_id) ?? '',
    }));
  }

  /**
   * Get latest payment (by created_at) per booking for given ids. Returns map booking_id -> { amount_cents, status }.
   */
  async getPaymentsByBookingIds(
    bookingIds: string[]
  ): Promise<Map<string, { amount_cents: number; status: string }>> {
    if (bookingIds.length === 0) return new Map();
    const supabase = requireSupabaseAdmin();
    const { data: payments, error } = await supabase
      .from('payments')
      .select('booking_id, amount_cents, status, created_at')
      .in('booking_id', bookingIds)
      .order('created_at', { ascending: false });

    if (error) return new Map();
    const map = new Map<string, { amount_cents: number; status: string }>();
    for (const p of payments || []) {
      if (!map.has(p.booking_id)) {
        map.set(p.booking_id, { amount_cents: p.amount_cents ?? 0, status: p.status ?? 'unknown' });
      }
    }
    return map;
  }
}

export const adminService = new AdminService();
