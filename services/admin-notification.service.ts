import { whatsappService } from './whatsapp.service';
import { getBaseUrl } from '@/lib/utils/url';
import { formatDate, formatTime } from '@/lib/utils/string';
import { NextRequest } from 'next/server';
import { ROUTES } from '@/lib/utils/navigation';

export class AdminNotificationService {
  async notifyBusinessOwner(
    businessId: string,
    message: string,
    request?: NextRequest
  ): Promise<string> {
    const { requireSupabaseAdmin } = await import('@/lib/supabase/server');
    const supabase = requireSupabaseAdmin();

    const { data: business } = await supabase
      .from('businesses')
      .select('whatsapp_number, salon_name, owner_name')
      .eq('id', businessId)
      .single();

    if (!business) {
      throw new Error('Business not found');
    }

    const whatsappUrl = whatsappService.getWhatsAppUrl(business.whatsapp_number, message);
    return whatsappUrl;
  }

  async notifyCustomer(bookingId: string, message: string, request?: NextRequest): Promise<string> {
    const { requireSupabaseAdmin } = await import('@/lib/supabase/server');
    const supabase = requireSupabaseAdmin();

    const { data: booking } = await supabase
      .from('bookings')
      .select('customer_phone, customer_name, business_id, slot_id')
      .eq('id', bookingId)
      .single();

    if (!booking) {
      throw new Error('Booking not found');
    }

    const whatsappUrl = whatsappService.getWhatsAppUrl(booking.customer_phone, message);
    return whatsappUrl;
  }

  generateBusinessUpdateMessage(
    businessName: string,
    changes: string[],
    request?: NextRequest
  ): string {
    const baseUrl = getBaseUrl(request);
    const bookingUrl = `${baseUrl}/owner/dashboard`;

    return (
      `🔔 *BUSINESS UPDATE NOTIFICATION*\n\n` +
      `Hello! Your business *${businessName}* has been updated by our admin team.\n\n` +
      `*Changes Made:*\n${changes.map((c) => `• ${c}`).join('\n')}\n\n` +
      `*View Your Dashboard:*\n${bookingUrl}\n\n` +
      `If you have any questions, please contact support.\n\n` +
      `Thank you! 🙏`
    );
  }

  generateBookingUpdateMessage(
    customerName: string,
    businessName: string,
    date: string,
    time: string,
    status: string,
    reason?: string,
    request?: NextRequest
  ): string {
    const baseUrl = getBaseUrl(request);
    const bookingUrl = `${baseUrl}${ROUTES.SALON_LIST}`;

    let statusMessage = '';
    if (status === 'confirmed') {
      statusMessage =
        `✅ *Your booking has been confirmed!*\n\n` +
        `Dear *${customerName}*,\n\n` +
        `Your appointment at *${businessName}* has been confirmed by our team.\n\n` +
        `*Appointment Details:*\n` +
        `📆 Date: *${date}*\n` +
        `🕐 Time: *${time}*\n\n` +
        `We look forward to seeing you!\n`;
    } else if (status === 'rejected' || status === 'cancelled') {
      statusMessage =
        `❌ *Booking Update*\n\n` +
        `Dear *${customerName}*,\n\n` +
        `Your booking at *${businessName}* has been ${status === 'cancelled' ? 'cancelled' : 'rejected'}.\n\n` +
        `*Original Booking:*\n` +
        `📆 Date: *${date}*\n` +
        `🕐 Time: *${time}*\n\n`;

      if (reason) {
        statusMessage += `*Reason:* ${reason}\n\n`;
      }

      statusMessage +=
        `*Book a New Slot:*\n${bookingUrl}\n\n` + `We apologize for any inconvenience.\n`;
    }

    return statusMessage + `Thank you! 🙏`;
  }

  generateUserUpdateMessage(userName: string, changes: string[]): string {
    return (
      `🔔 *ACCOUNT UPDATE NOTIFICATION*\n\n` +
      `Hello *${userName}*,\n\n` +
      `Your account has been updated by our admin team.\n\n` +
      `*Changes Made:*\n${changes.map((c) => `• ${c}`).join('\n')}\n\n` +
      `If you have any questions, please contact support.\n\n` +
      `Thank you! 🙏`
    );
  }
}

export const adminNotificationService = new AdminNotificationService();
