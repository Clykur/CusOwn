import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/supabase/server-auth';
import { userService } from '@/services/user.service';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { setNoCacheHeaders } from '@/lib/cache/next-cache';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const user = await getServerUser(request);
    if (!user) {
      return errorResponse('Authentication required', 401);
    }

    // Get all businesses for the user
    const businesses = await userService.getUserBusinesses(user.id);
    
    if (businesses.length === 0) {
      return successResponse({
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
      });
    }

    const businessIds = businesses.map(b => b.id);

    // Get all bookings across all businesses
    if (!supabaseAdmin) {
      throw new Error('Database not configured');
    }

    const { data: bookings, error } = await supabaseAdmin
      .from('bookings')
      .select('id, status, no_show, created_at, business_id, booking_id, customer_name, customer_phone')
      .in('business_id', businessIds)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[OWNER_DASHBOARD_STATS] Error fetching bookings:', error);
      throw new Error(error.message || 'Failed to fetch bookings');
    }

    const allBookings = bookings || [];
    const totalBookings = allBookings.length;
    const confirmedBookings = allBookings.filter(b => b.status === 'confirmed').length;
    const pendingBookings = allBookings.filter(b => b.status === 'pending').length;
    const rejectedBookings = allBookings.filter(b => b.status === 'rejected').length;
    const cancelledBookings = allBookings.filter(b => b.status === 'cancelled').length;
    const noShowCount = allBookings.filter(b => b.no_show === true).length;

    const conversionRate = totalBookings > 0 ? (confirmedBookings / totalBookings) * 100 : 0;
    const cancellationRate = totalBookings > 0 ? (cancelledBookings / totalBookings) * 100 : 0;
    const noShowRate = confirmedBookings > 0 ? (noShowCount / confirmedBookings) * 100 : 0;

    // Get recent bookings (last 10)
    const recentBookings = allBookings.slice(0, 10).map(booking => ({
      id: booking.id,
      booking_id: booking.booking_id,
      status: booking.status,
      customer_name: booking.customer_name,
      customer_phone: booking.customer_phone,
      created_at: booking.created_at,
      business_id: booking.business_id,
    }));

    const stats = {
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

    const response = successResponse(stats);
    setNoCacheHeaders(response);
    return response;
  } catch (error) {
    console.error('[OWNER_DASHBOARD_STATS] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch dashboard statistics';
    return errorResponse(message, 500);
  }
}
