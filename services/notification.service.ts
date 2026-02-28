import { supabaseAdmin } from '@/lib/supabase/server';
import { whatsappService } from './whatsapp.service';
import { ERROR_MESSAGES } from '@/config/constants';

export interface NotificationPreferences {
  emailEnabled: boolean;
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  emailAddress?: string;
  phoneNumber?: string;
}

export interface SendNotificationInput {
  bookingId: string;
  notificationType: 'whatsapp' | 'email' | 'sms';
  message: string;
  recipient: string;
}

export class NotificationService {
  async getNotificationPreferences(
    userId?: string,
    customerPhone?: string
  ): Promise<NotificationPreferences | null> {
    if (!supabaseAdmin) {
      throw new Error('Database not configured');
    }

    let query = supabaseAdmin.from('notification_preferences').select('*');

    if (userId) {
      query = query.eq('user_id', userId);
    } else if (customerPhone) {
      query = query.eq('customer_phone', customerPhone);
    } else {
      return null;
    }

    const { data, error } = await query.single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    return {
      emailEnabled: data.email_enabled ?? true,
      smsEnabled: data.sms_enabled ?? true,
      whatsappEnabled: data.whatsapp_enabled ?? true,
      emailAddress: data.email_address || undefined,
      phoneNumber: data.phone_number || undefined,
    };
  }

  async updateNotificationPreferences(
    userId?: string,
    customerPhone?: string,
    preferences: Partial<NotificationPreferences> = {}
  ): Promise<void> {
    if (!supabaseAdmin) {
      throw new Error('Database not configured');
    }

    const existing = await this.getNotificationPreferences(userId, customerPhone);

    const updateData: any = {
      email_enabled: preferences.emailEnabled ?? existing?.emailEnabled ?? true,
      sms_enabled: preferences.smsEnabled ?? existing?.smsEnabled ?? true,
      whatsapp_enabled: preferences.whatsappEnabled ?? existing?.whatsappEnabled ?? true,
      updated_at: new Date().toISOString(),
    };

    if (preferences.emailAddress !== undefined) {
      updateData.email_address = preferences.emailAddress || null;
    }
    if (preferences.phoneNumber !== undefined) {
      updateData.phone_number = preferences.phoneNumber || null;
    }

    if (existing) {
      let query = supabaseAdmin.from('notification_preferences').update(updateData);

      if (userId) {
        query = query.eq('user_id', userId);
      } else if (customerPhone) {
        query = query.eq('customer_phone', customerPhone);
      }

      const { error } = await query;
      if (error) {
        throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
      }
    } else {
      const insertData: any = {
        ...updateData,
        user_id: userId || null,
        customer_phone: customerPhone || null,
      };

      const { error } = await supabaseAdmin.from('notification_preferences').insert(insertData);
      if (error) {
        throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
      }
    }
  }

  async sendNotification(input: SendNotificationInput): Promise<any> {
    if (!supabaseAdmin) {
      throw new Error('Database not configured');
    }

    let status = 'pending';
    let sentAt: string | null = null;
    let errorMessage: string | null = null;

    try {
      if (input.notificationType === 'whatsapp') {
        const url = whatsappService.getWhatsAppUrl(input.recipient, input.message);
        status = 'sent';
        sentAt = new Date().toISOString();
      } else {
        status = 'failed';
        errorMessage = 'Email and SMS are not configured';
      }
    } catch (error) {
      status = 'failed';
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
    }

    const { data, error } = await supabaseAdmin
      .from('notification_history')
      .insert({
        booking_id: input.bookingId,
        notification_type: input.notificationType,
        recipient: input.recipient,
        status,
        message: input.message,
        error_message: errorMessage,
        sent_at: sentAt,
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    return data;
  }

  async getNotificationHistory(bookingId: string): Promise<any[]> {
    if (!supabaseAdmin) {
      throw new Error('Database not configured');
    }

    const { data, error } = await supabaseAdmin
      .from('notification_history')
      .select('*')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    return data || [];
  }

  async sendBookingNotification(
    bookingId: string,
    notificationType: 'whatsapp' | 'email' | 'sms',
    message: string,
    recipient: string
  ): Promise<any> {
    const preferences = await this.getNotificationPreferences(undefined, recipient);

    if (notificationType === 'whatsapp' && preferences?.whatsappEnabled === false) {
      throw new Error('WhatsApp notifications are disabled');
    }
    if (notificationType === 'email' && preferences?.emailEnabled === false) {
      throw new Error('Email notifications are disabled');
    }
    if (notificationType === 'sms' && preferences?.smsEnabled === false) {
      throw new Error('SMS notifications are disabled');
    }

    let result;
    try {
      result = await this.sendNotification({
        bookingId,
        notificationType,
        message,
        recipient,
      });
    } catch (error) {
      if (notificationType === 'whatsapp') {
        const fallbackType = preferences?.emailEnabled
          ? 'email'
          : preferences?.smsEnabled
            ? 'sms'
            : null;
        if (fallbackType) {
          try {
            result = await this.sendNotification({
              bookingId,
              notificationType: fallbackType,
              message,
              recipient,
            });
          } catch {
            throw error;
          }
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }

    return result;
  }
}

export const notificationService = new NotificationService();
