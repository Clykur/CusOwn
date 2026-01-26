import { requireSupabaseAdmin } from '@/lib/supabase/server';
import { env } from '@/config/env';

interface AbusePattern {
  userId?: string;
  ipAddress: string;
  pattern: 'rapid_reserve_expire' | 'multiple_failed_payments' | 'excessive_bookings';
  count: number;
  windowStart: Date;
  windowEnd: Date;
}

export class AbuseDetectionService {
  async detectSlotHoarding(userId: string | null, ipAddress: string): Promise<boolean> {
    const supabaseAdmin = requireSupabaseAdmin();
    const windowStart = new Date();
    windowStart.setMinutes(windowStart.getMinutes() - 10);

    const { data: recentReservations } = await supabaseAdmin
      .from('slots')
      .select('id, status, reserved_until')
      .eq('status', 'reserved')
      .gte('reserved_until', windowStart.toISOString())
      .limit(20);

    if (!recentReservations || recentReservations.length < 5) {
      return false;
    }

    const expiredCount = recentReservations.filter(
      s => s.reserved_until && new Date(s.reserved_until) < new Date()
    ).length;

    return expiredCount >= 3;
  }

  async detectMultipleFailedPayments(userId: string, bookingId: string): Promise<boolean> {
    const supabaseAdmin = requireSupabaseAdmin();
    const windowStart = new Date();
    windowStart.setHours(windowStart.getHours() - 1);

    const { data: failedPayments } = await supabaseAdmin
      .from('payment_attempts')
      .select('id')
      .eq('status', 'failed')
      .gte('created_at', windowStart.toISOString())
      .limit(env.payment.maxPaymentAttempts + 1);

    if (!failedPayments) {
      return false;
    }

    const booking = await supabaseAdmin
      .from('bookings')
      .select('id')
      .eq('id', bookingId)
      .eq('customer_user_id', userId)
      .single();

    if (!booking) {
      return false;
    }

    return failedPayments.length >= env.payment.maxPaymentAttempts;
  }

  async detectExcessiveBookings(userId: string | null, ipAddress: string): Promise<boolean> {
    const supabaseAdmin = requireSupabaseAdmin();
    const windowStart = new Date();
    windowStart.setHours(windowStart.getHours() - 1);

    let query = supabaseAdmin
      .from('bookings')
      .select('id')
      .gte('created_at', windowStart.toISOString());

    if (userId) {
      query = query.eq('customer_user_id', userId);
    }

    const { data: recentBookings } = await query.limit(20);

    return (recentBookings?.length || 0) >= 10;
  }

  async shouldBlockAction(
    userId: string | null,
    ipAddress: string,
    action: 'booking' | 'payment' | 'reserve'
  ): Promise<{ blocked: boolean; reason?: string }> {
    if (action === 'booking') {
      const excessive = await this.detectExcessiveBookings(userId, ipAddress);
      if (excessive) {
        return { blocked: true, reason: 'Excessive booking attempts detected' };
      }
    }

    if (action === 'reserve' && userId) {
      const hoarding = await this.detectSlotHoarding(userId, ipAddress);
      if (hoarding) {
        return { blocked: true, reason: 'Slot hoarding pattern detected' };
      }
    }

    if (action === 'payment' && userId) {
      const failed = await this.detectMultipleFailedPayments(userId, '');
      if (failed) {
        return { blocked: true, reason: 'Multiple failed payment attempts' };
      }
    }

    return { blocked: false };
  }
}

export const abuseDetectionService = new AbuseDetectionService();
