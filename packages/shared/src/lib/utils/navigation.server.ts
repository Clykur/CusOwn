import { getSecureSalonUrl, getSecureResourceUrl } from "./security.server";

/**
 * Server-only secure URL generation helpers.
 * These require SALON_TOKEN_SECRET and are NOT safe for the browser.
 */

export const getSecureSalonUrlServer = (salonId: string): string => {
  return getSecureSalonUrl(salonId);
};

export const getSecureBookingUrlServer = (bookingLink: string): string => {
  return getSecureResourceUrl("booking", bookingLink);
};

export const getSecureBookingStatusUrlServer = (bookingId: string): string => {
  return getSecureResourceUrl("booking-status", bookingId);
};

export const getSecureOwnerDashboardUrlServer = (
  bookingLink: string,
): string => {
  return getSecureResourceUrl("owner-dashboard", bookingLink);
};

export const getSecureAcceptUrlServer = (bookingId: string): string => {
  return getSecureResourceUrl("accept", bookingId);
};

export const getSecureRejectUrlServer = (bookingId: string): string => {
  return getSecureResourceUrl("reject", bookingId);
};
