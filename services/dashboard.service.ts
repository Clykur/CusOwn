/**
 * Dashboard service with Redis aggregation caching.
 * Reduces N+1 queries by fetching all dashboard data in optimized batch queries.
 * Caches aggregated results for fast subsequent loads.
 */

import { requireSupabaseAdmin } from '@/lib/supabase/server';
import { userService } from '@/services/user.service';
import { getCache, setCache, deletePattern } from '@/lib/cache/cache';
import { Salon, BookingWithDetails, Slot } from '@/types';
import { ERROR_MESSAGES } from '@/config/constants';
import { getISTDateString } from '@/lib/time/ist';

/** Dashboard cache TTL (30 seconds for real-time feel) */
const DASHBOARD_CACHE_TTL = 30;

/** Cache key prefixes */
const CACHE_PREFIX = {
  OWNER_DASHBOARD: 'dashboard:owner:',
  ADMIN_DASHBOARD: 'dashboard:admin:',
} as const;

/** Owner dashboard aggregated data */
export interface OwnerDashboardData {
  businesses: Salon[];
  stats: {
    totalBusinesses: number;
    totalBookings: number;
    confirmedBookings: number;
    pendingBookings: number;
    rejectedBookings: number;
    cancelledBookings: number;
    noShowCount: number;
    conversionRate: number;
    cancellationRate: number;
    noShowRate: number;
  };
  todaysBookings: BookingWithDetails[];
  pendingBookingsList: BookingWithDetails[];
  recentBookings: BookingWithDetails[];
  bookingsByBusiness: Record<string, BookingWithDetails[]>;
}

/** Admin dashboard booking summary (lighter than full BookingWithDetails) */
export interface AdminBookingSummary {
  id: string;
  business_id: string;
  status: string;
  customer_name: string;
  booking_id: string;
  created_at: string;
  slot_id: string;
  no_show: boolean;
  salon?: Salon;
}

/** Admin dashboard aggregated data */
export interface AdminDashboardData {
  stats: {
    totalBusinesses: number;
    totalOwners: number;
    totalBookings: number;
    todayBookings: number;
    pendingBookings: number;
    confirmedBookings: number;
    cancelledBookings: number;
    conversionRate: number;
  };
  recentBusinesses: Salon[];
  recentBookings: AdminBookingSummary[];
}

type ReviewSummary = {
  id: string;
  booking_id: string;
  rating: number;
  comment: string | null;
};

export class DashboardService {
  /**
   * Get owner dashboard with Redis caching.
   * Fetches all data in optimized batch queries.
   */
  async getOwnerDashboard(
    ownerId: string,
    options?: { fromDate?: string; toDate?: string }
  ): Promise<OwnerDashboardData> {
    const cacheKey = this.buildOwnerCacheKey(ownerId, options);

    const { hit, data: cached } = await getCache<OwnerDashboardData>(cacheKey);
    if (hit && cached) {
      return cached;
    }

    const data = await this.fetchOwnerDashboardData(ownerId, options);

    await setCache(cacheKey, data, DASHBOARD_CACHE_TTL);

    return data;
  }

  /**
   * Get admin dashboard with Redis caching.
   */
  async getAdminDashboard(): Promise<AdminDashboardData> {
    const cacheKey = `${CACHE_PREFIX.ADMIN_DASHBOARD}all`;

    const { hit, data: cached } = await getCache<AdminDashboardData>(cacheKey);
    if (hit && cached) {
      return cached;
    }

    const data = await this.fetchAdminDashboardData();

    await setCache(cacheKey, data, DASHBOARD_CACHE_TTL);

    return data;
  }

  /**
   * Invalidate owner dashboard cache.
   * Call after booking mutations affecting this owner.
   */
  async invalidateOwnerDashboard(ownerId: string): Promise<void> {
    try {
      await deletePattern(`${CACHE_PREFIX.OWNER_DASHBOARD}${ownerId}:*`);
    } catch {
      // Cache invalidation failure is non-critical
    }
  }

  /**
   * Invalidate admin dashboard cache.
   */
  async invalidateAdminDashboard(): Promise<void> {
    try {
      await deletePattern(`${CACHE_PREFIX.ADMIN_DASHBOARD}*`);
    } catch {
      // Cache invalidation failure is non-critical
    }
  }

  /**
   * Invalidate dashboard cache for a business.
   * Finds the owner and invalidates their dashboard.
   */
  async invalidateForBusiness(businessId: string): Promise<void> {
    try {
      const supabase = requireSupabaseAdmin();
      const { data: business } = await supabase
        .from('businesses')
        .select('owner_user_id')
        .eq('id', businessId)
        .single();

      if (business?.owner_user_id) {
        await this.invalidateOwnerDashboard(business.owner_user_id);
      }

      await this.invalidateAdminDashboard();
    } catch {
      // Cache invalidation failure is non-critical
    }
  }

  /**
   * Build cache key for owner dashboard with optional date filters.
   */
  private buildOwnerCacheKey(
    ownerId: string,
    options?: { fromDate?: string; toDate?: string }
  ): string {
    const base = `${CACHE_PREFIX.OWNER_DASHBOARD}${ownerId}`;
    if (options?.fromDate || options?.toDate) {
      return `${base}:${options.fromDate || 'any'}:${options.toDate || 'any'}`;
    }
    return `${base}:all`;
  }

  /**
   * Fetch all owner dashboard data in optimized queries.
   */
  private async fetchOwnerDashboardData(
    ownerId: string,
    options?: { fromDate?: string; toDate?: string }
  ): Promise<OwnerDashboardData> {
    const supabase = requireSupabaseAdmin();

    const businesses = await userService.getUserBusinesses(ownerId);

    if (businesses.length === 0) {
      return this.emptyOwnerDashboard();
    }

    const businessIds = businesses.map((b) => b.id);
    const todayStr = getISTDateString();

    let slotIds: string[] | null = null;
    if (options?.fromDate || options?.toDate) {
      let slotQuery = supabase.from('slots').select('id').in('business_id', businessIds);

      if (options.fromDate) slotQuery = slotQuery.gte('date', options.fromDate);
      if (options.toDate) slotQuery = slotQuery.lte('date', options.toDate);

      const { data: slots } = await slotQuery;
      if (slots && slots.length > 0) {
        slotIds = slots.map((s) => s.id);
      } else {
        return {
          businesses,
          stats: {
            totalBusinesses: businesses.length,
            totalBookings: 0,
            confirmedBookings: 0,
            pendingBookings: 0,
            rejectedBookings: 0,
            cancelledBookings: 0,
            noShowCount: 0,
            conversionRate: 0,
            cancellationRate: 0,
            noShowRate: 0,
          },
          todaysBookings: [],
          pendingBookingsList: [],
          recentBookings: [],
          bookingsByBusiness: {},
        };
      }
    }

    let bookingsQuery = supabase
      .from('bookings')
      .select(
        'id, business_id, slot_id, customer_name, customer_phone, booking_id, status, cancelled_by, cancellation_reason, cancelled_at, customer_user_id, no_show, no_show_marked_at, created_at, updated_at, undo_used_at'
      )
      .in('business_id', businessIds)
      .order('created_at', { ascending: false });

    if (slotIds) {
      bookingsQuery = bookingsQuery.in('slot_id', slotIds);
    }

    const { data: bookings, error: bookingsError } = await bookingsQuery;

    if (bookingsError) {
      console.error('[Dashboard] Error fetching bookings:', bookingsError);
      throw new Error(bookingsError.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    const allBookings = bookings || [];

    const bookingSlotIds = [...new Set(allBookings.map((b) => b.slot_id).filter(Boolean))];
    let slots: Slot[] = [];
    if (bookingSlotIds.length > 0) {
      const { data: slotsData } = await supabase
        .from('slots')
        .select('id, business_id, date, start_time, end_time, status, reserved_until')
        .in('id', bookingSlotIds);

      slots = (slotsData || []) as Slot[];
    }

    const bookingIds = allBookings.map((b) => b.id).filter(Boolean);

    let reviews: ReviewSummary[] = [];
    if (bookingIds.length > 0) {
      const { data: reviewsData, error: reviewsError } = await supabase
        .from('reviews')
        .select('id, booking_id, rating, comment')
        .in('booking_id', bookingIds);

      if (reviewsError) {
        console.error('[Dashboard] Error fetching reviews:', reviewsError);
        throw new Error(reviewsError.message || ERROR_MESSAGES.DATABASE_ERROR);
      }

      reviews = (reviewsData || []).map((review) => ({
        id: review.id,
        booking_id: review.booking_id,
        rating: Number(review.rating),
        comment: review.comment ?? null,
      }));
    }

    const slotMap = new Map<string, Slot>();
    slots.forEach((slot) => slotMap.set(slot.id, slot));

    const businessMap = new Map<string, Salon>();
    businesses.forEach((business) => businessMap.set(business.id, business));

    const reviewMap = new Map<string, ReviewSummary>();
    reviews.forEach((review) => {
      reviewMap.set(review.booking_id, review);
    });

    const enrichedBookings: BookingWithDetails[] = allBookings.map((booking) => ({
      ...booking,
      slot: slotMap.get(booking.slot_id) || undefined,
      salon: businessMap.get(booking.business_id) || undefined,
      review: reviewMap.get(booking.id) || undefined,
    }));

    const totalBookings = enrichedBookings.length;
    const confirmedBookings = enrichedBookings.filter((b) => b.status === 'confirmed').length;
    const pendingBookings = enrichedBookings.filter((b) => b.status === 'pending').length;
    const rejectedBookings = enrichedBookings.filter((b) => b.status === 'rejected').length;
    const cancelledBookings = enrichedBookings.filter((b) => b.status === 'cancelled').length;
    const noShowCount = enrichedBookings.filter((b) => b.no_show === true).length;

    const conversionRate = totalBookings > 0 ? (confirmedBookings / totalBookings) * 100 : 0;
    const cancellationRate = totalBookings > 0 ? (cancelledBookings / totalBookings) * 100 : 0;
    const noShowRate = confirmedBookings > 0 ? (noShowCount / confirmedBookings) * 100 : 0;

    const todaysBookings = enrichedBookings.filter((b) => b.slot?.date === todayStr);
    const pendingBookingsList = enrichedBookings.filter((b) => b.status === 'pending');
    const recentBookings = enrichedBookings.slice(0, 50);

    const bookingsByBusiness: Record<string, BookingWithDetails[]> = {};
    businessIds.forEach((id) => {
      bookingsByBusiness[id] = enrichedBookings.filter((b) => b.business_id === id);
    });

    return {
      businesses,
      stats: {
        totalBusinesses: businesses.length,
        totalBookings,
        confirmedBookings,
        pendingBookings,
        rejectedBookings,
        cancelledBookings,
        noShowCount,
        conversionRate: Math.round(conversionRate * 100) / 100,
        cancellationRate: Math.round(cancellationRate * 100) / 100,
        noShowRate: Math.round(noShowRate * 100) / 100,
      },
      todaysBookings,
      pendingBookingsList,
      recentBookings,
      bookingsByBusiness,
    };
  }

  /**
   * Fetch admin dashboard data.
   */
  private async fetchAdminDashboardData(): Promise<AdminDashboardData> {
    const supabase = requireSupabaseAdmin();
    const todayStr = getISTDateString();

    const [businessesResult, ownersResult, bookingsResult, todaySlotsResult] = await Promise.all([
      supabase
        .from('businesses')
        .select('id, salon_name, owner_name, booking_link, created_at, owner_user_id')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(100),

      supabase
        .from('user_profiles')
        .select('id')
        .or('user_type.eq.owner,user_type.eq.both,user_type.eq.admin'),

      supabase
        .from('bookings')
        .select('id, business_id, status, customer_name, booking_id, created_at, slot_id, no_show')
        .order('created_at', { ascending: false })
        .limit(1000),

      supabase.from('slots').select('id').eq('date', todayStr),
    ]);

    const businesses = (businessesResult.data || []) as Salon[];
    const owners = ownersResult.data || [];
    const allBookings = bookingsResult.data || [];
    const todaySlotIds = new Set((todaySlotsResult.data || []).map((s) => s.id));

    const todayBookings = allBookings.filter((b) => todaySlotIds.has(b.slot_id));
    const confirmedBookings = allBookings.filter((b) => b.status === 'confirmed').length;
    const pendingBookings = allBookings.filter((b) => b.status === 'pending').length;
    const cancelledBookings = allBookings.filter((b) => b.status === 'cancelled').length;
    const conversionRate =
      allBookings.length > 0 ? (confirmedBookings / allBookings.length) * 100 : 0;

    const businessMap = new Map<string, Salon>();
    businesses.forEach((b) => businessMap.set(b.id, b));

    const recentBookings: AdminBookingSummary[] = allBookings.slice(0, 20).map((b) => ({
      id: b.id,
      business_id: b.business_id,
      status: b.status,
      customer_name: b.customer_name,
      booking_id: b.booking_id,
      created_at: b.created_at,
      slot_id: b.slot_id,
      no_show: b.no_show || false,
      salon: businessMap.get(b.business_id) || undefined,
    }));

    return {
      stats: {
        totalBusinesses: businesses.length,
        totalOwners: owners.length,
        totalBookings: allBookings.length,
        todayBookings: todayBookings.length,
        pendingBookings,
        confirmedBookings,
        cancelledBookings,
        conversionRate: Math.round(conversionRate * 100) / 100,
      },
      recentBusinesses: businesses.slice(0, 10),
      recentBookings,
    };
  }

  /**
   * Return empty owner dashboard structure.
   */
  private emptyOwnerDashboard(): OwnerDashboardData {
    return {
      businesses: [],
      stats: {
        totalBusinesses: 0,
        totalBookings: 0,
        confirmedBookings: 0,
        pendingBookings: 0,
        rejectedBookings: 0,
        cancelledBookings: 0,
        noShowCount: 0,
        conversionRate: 0,
        cancellationRate: 0,
        noShowRate: 0,
      },
      todaysBookings: [],
      pendingBookingsList: [],
      recentBookings: [],
      bookingsByBusiness: {},
    };
  }
}

export const dashboardService = new DashboardService();
