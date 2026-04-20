import { requireSupabaseAdmin } from '@/lib/supabase/server';
import { bookingService } from './booking.service';
import { ERROR_MESSAGES } from '@/config/constants';
import { env } from '@/config/env';
import { BookingWithDetails } from '@/types';
import { retry } from '@/lib/resilience/retry';
import { whatsappCircuitBreaker } from '@/lib/resilience/circuit-breaker';

export type BookingReminder = {
  id: string;
  booking_id: string;
  reminder_type: '24h_before' | '2h_before' | 'custom';
  scheduled_at: string;
  sent_at?: string | null;
  channel: 'whatsapp' | 'sms' | 'email';
  status: 'pending' | 'sent' | 'failed';
  error_message?: string | null;
  created_at: string;
  updated_at: string;
};

export class ReminderService {
  async createReminder(
    bookingId: string,
    reminderType: '24h_before' | '2h_before' | 'custom',
    scheduledAt: string,
    channel: 'whatsapp' | 'sms' | 'email'
  ): Promise<BookingReminder> {
    const supabaseAdmin = requireSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('booking_reminders')
      .insert({
        booking_id: bookingId,
        reminder_type: reminderType,
        scheduled_at: scheduledAt,
        channel: channel,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }
    if (!data) {
      throw new Error(ERROR_MESSAGES.DATABASE_ERROR);
    }
    return data;
  }

  /** Cancel pending reminders for a booking (e.g. when owner undoes accept). */
  async cancelRemindersForBooking(bookingId: string): Promise<void> {
    const supabaseAdmin = requireSupabaseAdmin();
    await supabaseAdmin
      .from('booking_reminders')
      .delete()
      .eq('booking_id', bookingId)
      .eq('status', 'pending');
  }

  async scheduleBookingReminders(bookingId: string): Promise<void> {
    const booking = await bookingService.getBookingByUuidWithDetails(bookingId);
    if (!booking || !booking.slot) {
      return;
    }

    if (booking.status !== 'confirmed') {
      return;
    }

    const slotDateTime = new Date(`${booking.slot.date}T${booking.slot.start_time}`);
    const now = new Date();

    const reminder24h = new Date(slotDateTime);
    reminder24h.setHours(reminder24h.getHours() - env.booking.reminder24hBeforeHours);
    if (reminder24h > now) {
      await this.createReminder(bookingId, '24h_before', reminder24h.toISOString(), 'whatsapp');
    }

    const reminder2h = new Date(slotDateTime);
    reminder2h.setHours(reminder2h.getHours() - env.booking.reminder2hBeforeHours);
    if (reminder2h > now) {
      await this.createReminder(bookingId, '2h_before', reminder2h.toISOString(), 'whatsapp');
    }
  }

  async getPendingReminders(limit: number = 100): Promise<BookingReminder[]> {
    const supabaseAdmin = requireSupabaseAdmin();
    const now = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from('booking_reminders')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_at', now)
      .order('scheduled_at', { ascending: true })
      .limit(limit);

    if (error) {
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }
    return data || [];
  }

  async sendReminder(reminderId: string): Promise<void> {
    const supabaseAdmin = requireSupabaseAdmin();
    const { data: reminder, error: fetchError } = await supabaseAdmin
      .from('booking_reminders')
      .select('*')
      .eq('id', reminderId)
      .single();

    if (fetchError || !reminder) {
      throw new Error(ERROR_MESSAGES.REMINDER_NOT_FOUND);
    }

    if (reminder.status === 'sent') {
      throw new Error(ERROR_MESSAGES.REMINDER_ALREADY_SENT);
    }

    const booking = await bookingService.getBookingByUuidWithDetails(reminder.booking_id);
    if (!booking || !booking.slot || !booking.salon) {
      await this.markReminderFailed(reminderId, 'Booking not found');
      return;
    }

    if (booking.status !== 'confirmed') {
      await this.markReminderFailed(reminderId, 'Booking not confirmed');
      return;
    }

    try {
      if (reminder.channel === 'whatsapp') {
        await whatsappCircuitBreaker.execute(async () => {
          return retry(() => this.sendWhatsAppReminder(booking), {
            maxAttempts: 3,
            initialDelayMs: 1000,
          });
        });
      }
      await this.markReminderSent(reminderId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.markReminderFailed(reminderId, errorMessage);
      throw error;
    }
  }

  private async sendWhatsAppReminder(booking: BookingWithDetails): Promise<void> {
    if (!booking.slot || !booking.salon) {
      throw new Error('Booking details incomplete');
    }
    return;
  }

  private async markReminderSent(reminderId: string): Promise<void> {
    const supabaseAdmin = requireSupabaseAdmin();
    const now = new Date().toISOString();
    await supabaseAdmin
      .from('booking_reminders')
      .update({ status: 'sent', sent_at: now })
      .eq('id', reminderId);
  }

  private async markReminderFailed(reminderId: string, errorMessage: string): Promise<void> {
    const supabaseAdmin = requireSupabaseAdmin();
    await supabaseAdmin
      .from('booking_reminders')
      .update({ status: 'failed', error_message: errorMessage })
      .eq('id', reminderId);
  }
}

export const reminderService = new ReminderService();
