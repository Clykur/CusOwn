import { formatPhoneNumber } from '@/lib/utils/string';

export type BookingDetailsForWhatsApp = {
  salonName: string;
  serviceName?: string | null;
  date: string; // ISO date or display-friendly
  time: string; // display-friendly time range
  customerName: string;
  bookingId: string;
};

export function generateWhatsAppLink({
  phoneNumber,
  bookingDetails,
}: {
  phoneNumber: string;
  bookingDetails: BookingDetailsForWhatsApp;
}): string {
  // Normalize phone to E.164-like using existing formatter
  const normalized = formatPhoneNumber(String(phoneNumber || '').trim());

  // Build a simple, clear message (avoid double-encoding later)
  const parts: string[] = [];
  parts.push(`Hello,`);
  parts.push(`Business: ${bookingDetails.salonName}`);
  if (bookingDetails.serviceName) parts.push(`Service: ${bookingDetails.serviceName}`);
  parts.push(`Date: ${bookingDetails.date}`);
  parts.push(`Time: ${bookingDetails.time}`);
  parts.push(`Customer: ${bookingDetails.customerName}`);
  parts.push(`Booking ID: ${bookingDetails.bookingId}`);

  const message = parts.join('\n');
  const encoded = encodeURIComponent(message);

  return `https://wa.me/${normalized.replace(/^\+/, '')}?text=${encoded}`;
}

export default generateWhatsAppLink;
