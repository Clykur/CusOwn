import { WHATSAPP_MESSAGE_TEMPLATES, ROUTES } from '@/config/constants';
import { BookingWithDetails, Salon } from '@/types';
import { getBookingUrl, getBaseUrl } from '@/lib/utils/url';
import { formatDate, formatTime } from '@/lib/utils/string';
import { NextRequest } from 'next/server';

export class WhatsAppService {
  getWhatsAppUrl(phoneNumber: string, message: string): string {
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    const encodedMessage = encodeURIComponent(message);
    return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
  }

  generateBookingRequestMessage(
    booking: BookingWithDetails,
    salon: Salon,
    request?: NextRequest
  ): { message: string; whatsappUrl: string } {
    if (!booking.slot) {
      throw new Error('Slot information is missing');
    }

    const date = formatDate(booking.slot.date);
    const time = `${formatTime(booking.slot.start_time)} - ${formatTime(booking.slot.end_time)}`;

    const message = WHATSAPP_MESSAGE_TEMPLATES.BOOKING_REQUEST(
      booking.customer_name,
      date,
      time,
      booking.booking_id
    );

    const baseUrl = getBaseUrl(request);
    const acceptUrl = `${baseUrl}${ROUTES.ACCEPT}/${booking.id}`;
    const rejectUrl = `${baseUrl}${ROUTES.REJECT}/${booking.id}`;

    const messageWithLinks = `${message}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n*ACTION REQUIRED*\n\n` +
      `🟢 *ACCEPT* - Confirm this booking:\n${acceptUrl}\n\n` +
      `🔴 *NOT AVAILABLE* - Reject this booking:\n${rejectUrl}`;

    return {
      message: messageWithLinks,
      whatsappUrl: this.getWhatsAppUrl(salon.whatsapp_number, messageWithLinks),
    };
  }

  generateConfirmationMessage(booking: BookingWithDetails, salon: Salon): string {
    if (!booking.slot) {
      throw new Error('Slot information is missing');
    }

    if (!salon.address) {
      throw new Error('Salon address is required');
    }

    const date = formatDate(booking.slot.date);
    const time = `${formatTime(booking.slot.start_time)} - ${formatTime(booking.slot.end_time)}`;

    // Generate Google Maps link
    const encodedAddress = encodeURIComponent(salon.address);
    const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;

    return WHATSAPP_MESSAGE_TEMPLATES.CONFIRMATION(
      booking.customer_name,
      date,
      time,
      salon.salon_name,
      salon.address,
      mapsLink
    );
  }

  generateRejectionMessage(booking: BookingWithDetails, salon: Salon, request?: NextRequest): string {
    const bookingUrl = getBookingUrl(salon.booking_link, request);
    return WHATSAPP_MESSAGE_TEMPLATES.REJECTION(booking.customer_name, bookingUrl);
  }

  getConfirmationWhatsAppUrl(booking: BookingWithDetails, salon: Salon, request?: NextRequest): string {
    const message = this.generateConfirmationMessage(booking, salon);
    return this.getWhatsAppUrl(booking.customer_phone, message);
  }

  getRejectionWhatsAppUrl(booking: BookingWithDetails, salon: Salon, request?: NextRequest): string {
    const message = this.generateRejectionMessage(booking, salon, request);
    return this.getWhatsAppUrl(booking.customer_phone, message);
  }
}

export const whatsappService = new WhatsAppService();

