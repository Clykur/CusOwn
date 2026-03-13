import { NextRequest } from 'next/server';
import { getServerUser } from '@/lib/supabase/server-auth';
import { userService } from '@/services/user.service';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { setCacheHeaders } from '@/lib/cache/next-cache';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getCache, setCache, buildCacheKey, CACHE_PREFIX, CACHE_TTL } from '@/lib/cache/cache';

interface DashboardStats {
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
  recentBookings: Array<{
    id: string;
    booking_id: string;
    status: string;
    customer_name: string;
    customer_phone: string;
    created_at: string;
    business_id: string;
  }>;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getServerUser(request);
    if (!user) {
      return errorResponse('Authentication required', 401);
    }

    const { searchParams } = new URL(request.url);
    const fromDate = searchParams.get('fromDate') || '';
    const toDate = searchParams.get('toDate') || '';

    const cacheKey = buildCacheKey(
      CACHE_PREFIX.DASHBOARD,
      'owner-stats',
      user.id,
      fromDate,
      toDate
    );

    const { hit, data: cachedStats } = await getCache<DashboardStats>(cacheKey);
    if (hit && cachedStats) {
      const response = successResponse(cachedStats);
      setCacheHeaders(response, CACHE_TTL.DASHBOARD, CACHE_TTL.DASHBOARD * 2);
      return response;
    }

    const businesses = await userService.getUserBusinesses(user.id);

    if (businesses.length === 0) {
      const emptyStats: DashboardStats = {
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
        recentBookings: [],
      };
      await setCache(cacheKey, emptyStats, CACHE_TTL.DASHBOARD);
      return successResponse(emptyStats);
    }

    const businessIds = businesses.map((b) => b.id);

    if (!supabaseAdmin) {
      throw new Error('Database not configured');
    }

    let query = supabaseAdmin
      .from('bookings')
      .select(
        'id, status, no_show, created_at, business_id, booking_id, customer_name, customer_phone, slot_id'
      )
      .in('business_id', businessIds);

    if (fromDate || toDate) {
      let slotQuery = supabaseAdmin.from('slots').select('id').in('business_id', businessIds);

      if (fromDate) slotQuery = slotQuery.gte('date', fromDate);
      if (toDate) slotQuery = slotQuery.lte('date', toDate);

      const { data: slots } = await slotQuery;

      if (slots && slots.length > 0) {
        query = query.in(
          'slot_id',
          slots.map((s) => s.id)
        );
      } else {
        const emptyStats: DashboardStats = {
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
          recentBookings: [],
        };
        await setCache(cacheKey, emptyStats, CACHE_TTL.DASHBOARD);
        return successResponse(emptyStats);
      }
    }

    const { data: bookings, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('[OWNER_DASHBOARD_STATS] Error fetching bookings:', error);
      throw new Error(error.message || 'Failed to fetch bookings');
    }

    const allBookings = bookings || [];
    const totalBookings = allBookings.length;
    const confirmedBookings = allBookings.filter((b) => b.status === 'confirmed').length;
    const pendingBookings = allBookings.filter((b) => b.status === 'pending').length;
    const rejectedBookings = allBookings.filter((b) => b.status === 'rejected').length;
    const cancelledBookings = allBookings.filter((b) => b.status === 'cancelled').length;
    const noShowCount = allBookings.filter((b) => b.no_show === true).length;

    const conversionRate = totalBookings > 0 ? (confirmedBookings / totalBookings) * 100 : 0;
    const cancellationRate = totalBookings > 0 ? (cancelledBookings / totalBookings) * 100 : 0;
    const noShowRate = confirmedBookings > 0 ? (noShowCount / confirmedBookings) * 100 : 0;

    const recentBookings = allBookings.slice(0, 10).map((booking) => ({
      id: booking.id,
      booking_id: booking.booking_id,
      status: booking.status,
      customer_name: booking.customer_name,
      customer_phone: booking.customer_phone,
      created_at: booking.created_at,
      business_id: booking.business_id,
    }));

    const stats: DashboardStats = {
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
      recentBookings,
    };

    await setCache(cacheKey, stats, CACHE_TTL.DASHBOARD);

    const response = successResponse(stats);
    setCacheHeaders(response, CACHE_TTL.DASHBOARD, CACHE_TTL.DASHBOARD * 2);
    return response;
  } catch (error) {
    console.error('[OWNER_DASHBOARD_STATS] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch dashboard statistics';
    return errorResponse(message, 500);
  }
}
