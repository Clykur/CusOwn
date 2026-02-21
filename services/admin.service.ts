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
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const countOpt = { count: 'exact' as const, head: true };
    const selectId = 'id';

    const [
      totalBusinessesRes,
      activeBusinessesRes,
      suspendedBusinessesRes,
      totalOwnersRes,
      totalCustomersRes,
      totalBookingsRes,
      confirmedBookingsRes,
      rejectedBookingsRes,
      pendingBookingsRes,
      cancelledBookingsRes,
      bookingsTodayRes,
      bookingsThisWeekRes,
      bookingsThisMonthRes,
      businessesLast30Res,
      businessesPrev30Res,
      bookingsLast30Res,
      bookingsPrev30Res,
      ownersLast30Res,
      ownersPrev30Res,
    ] = await Promise.all([
      supabase.from('businesses').select(selectId, countOpt),
      supabase.from('businesses').select(selectId, countOpt).eq('suspended', false),
      supabase.from('businesses').select(selectId, countOpt).eq('suspended', true),
      supabase
        .from('user_profiles')
        .select(selectId, countOpt)
        .in('user_type', ['owner', 'both', 'admin']),
      supabase
        .from('user_profiles')
        .select(selectId, countOpt)
        .in('user_type', ['customer', 'both']),
      supabase.from('bookings').select(selectId, countOpt),
      supabase.from('bookings').select(selectId, countOpt).eq('status', 'confirmed'),
      supabase.from('bookings').select(selectId, countOpt).eq('status', 'rejected'),
      supabase.from('bookings').select(selectId, countOpt).eq('status', 'pending'),
      supabase.from('bookings').select(selectId, countOpt).eq('status', 'cancelled'),
      supabase.from('bookings').select(selectId, countOpt).gte('created_at', `${today}T00:00:00Z`),
      supabase.from('bookings').select(selectId, countOpt).gte('created_at', weekAgo.toISOString()),
      supabase
        .from('bookings')
        .select(selectId, countOpt)
        .gte('created_at', monthAgo.toISOString()),
      supabase
        .from('businesses')
        .select(selectId, countOpt)
        .gte('created_at', thirtyDaysAgo.toISOString()),
      supabase
        .from('businesses')
        .select(selectId, countOpt)
        .gte('created_at', sixtyDaysAgo.toISOString())
        .lt('created_at', thirtyDaysAgo.toISOString()),
      supabase
        .from('bookings')
        .select(selectId, countOpt)
        .gte('created_at', thirtyDaysAgo.toISOString()),
      supabase
        .from('bookings')
        .select(selectId, countOpt)
        .gte('created_at', sixtyDaysAgo.toISOString())
        .lt('created_at', thirtyDaysAgo.toISOString()),
      supabase
        .from('user_profiles')
        .select(selectId, countOpt)
        .in('user_type', ['owner', 'both', 'admin'])
        .gte('created_at', thirtyDaysAgo.toISOString()),
      supabase
        .from('user_profiles')
        .select(selectId, countOpt)
        .in('user_type', ['owner', 'both', 'admin'])
        .gte('created_at', sixtyDaysAgo.toISOString())
        .lt('created_at', thirtyDaysAgo.toISOString()),
    ]);

    const n = (r: { count?: number | null }) => r?.count ?? 0;
    const totalBusinesses = n(totalBusinessesRes);
    const activeBusinesses = n(activeBusinessesRes);
    const suspendedBusinesses = n(suspendedBusinessesRes);
    const totalOwners = n(totalOwnersRes);
    const totalCustomers = n(totalCustomersRes);
    const totalBookings = n(totalBookingsRes);
    const confirmedBookings = n(confirmedBookingsRes);
    const rejectedBookings = n(rejectedBookingsRes);
    const pendingBookings = n(pendingBookingsRes);
    const cancelledBookings = n(cancelledBookingsRes);
    const bookingsToday = n(bookingsTodayRes);
    const bookingsThisWeek = n(bookingsThisWeekRes);
    const bookingsThisMonth = n(bookingsThisMonthRes);
    const businessesLast30 = n(businessesLast30Res);
    const businessesPrev30 = n(businessesPrev30Res);
    const bookingsLast30 = n(bookingsLast30Res);
    const bookingsPrev30 = n(bookingsPrev30Res);
    const ownersLast30 = n(ownersLast30Res);
    const ownersPrev30 = n(ownersPrev30Res);

    const calculateGrowthRate = (current: number, previous: number): number => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    return {
      totalBusinesses,
      activeBusinesses,
      suspendedBusinesses,
      totalOwners,
      totalCustomers,
      totalBookings,
      confirmedBookings,
      rejectedBookings,
      pendingBookings,
      cancelledBookings,
      bookingsToday,
      bookingsThisWeek,
      bookingsThisMonth,
      growthRate: {
        businesses: calculateGrowthRate(businessesLast30, businessesPrev30),
        bookings: calculateGrowthRate(bookingsLast30, bookingsPrev30),
        owners: calculateGrowthRate(ownersLast30, ownersPrev30),
      },
    };
  }

  async getAllBusinesses(): Promise<BusinessWithOwner[]> {
    const supabase = requireSupabaseAdmin();

    const { data: businesses, error } = await supabase
      .from('businesses')
      .select(
        'id, owner_user_id, salon_name, booking_link, address, location, suspended, created_at'
      )
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch businesses: ${error.message}`);
    }

    if (!businesses?.length) return [];

    const businessIds = businesses.map((b) => b.id);
    const ownerIds = [
      ...new Set(businesses.map((b) => b.owner_user_id).filter(Boolean)),
    ] as string[];

    const [profilesRes, bookingCountsRes, recentBookingsRes, ...authUsers] = await Promise.all([
      ownerIds.length > 0
        ? supabase.from('user_profiles').select('id, user_type, full_name').in('id', ownerIds)
        : Promise.resolve({ data: [] }),
      supabase.from('bookings').select('business_id').in('business_id', businessIds),
      supabase
        .from('bookings')
        .select('business_id, id, customer_name, status, created_at')
        .in('business_id', businessIds)
        .order('created_at', { ascending: false })
        .limit(Math.min(500, businesses.length * 5)),
      ...ownerIds.map((id) => supabase.auth.admin.getUserById(id)),
    ]);

    const profileMap = new Map<
      string,
      { id: string; user_type: string; full_name: string | null }
    >();
    (profilesRes.data || []).forEach((p) => profileMap.set(p.id, p));

    const countByBusiness = new Map<string, number>();
    (bookingCountsRes.data || []).forEach((r) => {
      countByBusiness.set(r.business_id, (countByBusiness.get(r.business_id) ?? 0) + 1);
    });

    const recentByBusiness = new Map<
      string,
      { id: string; customer_name: string; status: string; created_at: string }[]
    >();
    (recentBookingsRes.data || []).forEach((r) => {
      const list = recentByBusiness.get(r.business_id) ?? [];
      if (list.length < 5)
        list.push({
          id: r.id,
          customer_name: r.customer_name,
          status: r.status,
          created_at: r.created_at,
        });
      recentByBusiness.set(r.business_id, list);
    });

    const emailByOwnerId = new Map<string, string>();
    authUsers.forEach((res: unknown, i: number) => {
      const id = ownerIds[i];
      const user = (res as { data?: { user?: { email?: string } | null } })?.data?.user;
      if (id && user && typeof user === 'object' && 'email' in user)
        emailByOwnerId.set(id, String((user as { email?: string }).email ?? ''));
    });

    return businesses.map((business) => {
      let owner: BusinessWithOwner['owner'] = null;
      if (business.owner_user_id) {
        const profile = profileMap.get(business.owner_user_id);
        if (profile) {
          owner = {
            id: profile.id,
            email: emailByOwnerId.get(business.owner_user_id) ?? '',
            full_name: profile.full_name,
            user_type: profile.user_type,
          };
        }
      }
      return {
        ...business,
        owner,
        bookingCount: countByBusiness.get(business.id) ?? 0,
        recentBookings: recentByBusiness.get(business.id) ?? [],
      };
    });
  }

  async getAllUsers(options?: { limit?: number; offset?: number }): Promise<any[]> {
    const supabase = requireSupabaseAdmin();
    const limit = Math.min(100, Math.max(1, options?.limit ?? 50));
    const offset = Math.max(0, options?.offset ?? 0);

    const { data: profiles, error } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to fetch users: ${error.message}`);
    }

    if (!profiles?.length) return [];

    const profileIds = profiles.map((p) => p.id);

    // Batch: all businesses for these owners
    const { data: allBusinesses } = await supabase
      .from('businesses')
      .select('id, salon_name, booking_link, owner_user_id')
      .in('owner_user_id', profileIds);
    const businessesByOwner = new Map<string, any[]>();
    for (const b of allBusinesses ?? []) {
      const id = b.owner_user_id;
      if (!businessesByOwner.has(id)) businessesByOwner.set(id, []);
      businessesByOwner.get(id)!.push(b);
    }

    // Batch: booking counts per customer
    const { data: bookingRows } = await supabase
      .from('bookings')
      .select('customer_user_id')
      .in('customer_user_id', profileIds);
    const countByCustomer = new Map<string, number>();
    for (const id of profileIds) countByCustomer.set(id, 0);
    for (const row of bookingRows ?? []) {
      const id = row.customer_user_id;
      if (id != null) countByCustomer.set(id, (countByCustomer.get(id) ?? 0) + 1);
    }

    // Auth email per profile (no batch API)
    const usersWithDetails = await Promise.all(
      profiles.map(async (profile) => {
        const { data: authUser } = await supabase.auth.admin.getUserById(profile.id);
        return {
          ...profile,
          email: authUser?.user?.email ?? '',
          businesses: businessesByOwner.get(profile.id) ?? [],
          bookingCount: countByCustomer.get(profile.id) ?? 0,
        };
      })
    );

    return usersWithDetails;
  }

  /** Get a single user by id for admin user detail page. */
  async getAdminUserById(userId: string): Promise<any> {
    const supabase = requireSupabaseAdmin();
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') throw new Error('User not found');
      throw new Error(`Failed to fetch user: ${error.message}`);
    }
    if (!profile) throw new Error('User not found');

    const { data: authUser } = await supabase.auth.admin.getUserById(profile.id);
    const email = authUser?.user?.email ?? '';
    const isBanned =
      typeof (authUser?.user as { banned_until?: string } | undefined)?.banned_until === 'string';

    const { data: ownerBusinesses } = await supabase
      .from('businesses')
      .select('id, salon_name, booking_link, owner_user_id')
      .eq('owner_user_id', profile.id);
    const { count } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('customer_user_id', profile.id);

    return {
      ...profile,
      email,
      is_banned: isBanned,
      businesses: ownerBusinesses ?? [],
      bookingCount: count ?? 0,
    };
  }

  /** Block user (Supabase Auth ban). Blocked users cannot sign in. */
  async blockUser(userId: string): Promise<void> {
    const supabase = requireSupabaseAdmin();
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      ban_duration: '876600h',
    } as { ban_duration: string });
    if (error) throw new Error(error.message || 'Failed to block user');
  }

  /** Unblock user (Supabase Auth unban). */
  async unblockUser(userId: string): Promise<void> {
    const supabase = requireSupabaseAdmin();
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      ban_duration: 'none',
    } as { ban_duration: string });
    if (error) throw new Error(error.message || 'Failed to unblock user');
  }

  /** Delete user from Auth (cascades depend on DB FKs). Cannot delete self. */
  async deleteUser(userId: string, requestingAdminId: string): Promise<void> {
    if (userId === requestingAdminId) throw new Error('Cannot delete your own account');
    const supabase = requireSupabaseAdmin();
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message || 'Failed to delete user');
  }

  /** Update admin-editable profile fields (admin_note, user_type). */
  async updateAdminUserProfile(
    userId: string,
    updates: { admin_note?: string | null; user_type?: string }
  ): Promise<any> {
    const supabase = requireSupabaseAdmin();
    const body: Record<string, unknown> = {};
    if (updates.admin_note !== undefined) body.admin_note = updates.admin_note;
    if (updates.user_type !== undefined) body.user_type = updates.user_type;
    if (Object.keys(body).length === 0) return this.getAdminUserById(userId);

    const validTypes = ['owner', 'customer', 'both', 'admin'];
    if (body.user_type !== undefined && !validTypes.includes(body.user_type as string)) {
      throw new Error('Invalid user_type');
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .update(body)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw new Error(error.message || 'Failed to update user');
    return data;
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
