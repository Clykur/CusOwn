import { BOOKING_LINK_PREFIX } from '@/config/constants';
import { env } from '@/config/env';

export const getBookingUrl = (bookingLink: string): string => {
  return `${env.app.baseUrl}${BOOKING_LINK_PREFIX}${bookingLink}`;
};

export const getApiUrl = (path: string): string => {
  return `${env.app.baseUrl}${path}`;
};

