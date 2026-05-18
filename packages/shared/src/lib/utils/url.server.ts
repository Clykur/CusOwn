import { NextRequest } from 'next/server';
import { getBaseUrl as getClientBaseUrl } from './url';
import { BOOKING_LINK_PREFIX } from '@cusown/config';

/**
 * Server-only URL helpers with NextRequest support.
 */

const isLocalhost = (url: string): boolean => {
  return url.includes('localhost') || url.includes('127.0.0.1') || url.includes('0.0.0.0');
};

export const getBaseUrl = (request?: NextRequest): string => {
  if (!request) return getClientBaseUrl();

  const origin = request.nextUrl?.origin;
  if (origin && !isLocalhost(origin)) return origin;

  const host = request.headers.get('host');
  if (host && !isLocalhost(host)) {
    const protocol =
      request.headers.get('x-forwarded-proto') ||
      request.headers.get('x-forwarded-protocol') ||
      'https';
    return `${protocol}://${host}`;
  }

  return getClientBaseUrl();
};

export const getApiUrl = (path: string, request?: NextRequest): string => {
  const baseUrl = getBaseUrl(request);
  return `${baseUrl}${path}`;
};

export const getBookingUrl = (bookingLink: string, request?: NextRequest): string => {
  const baseUrl = getBaseUrl(request);
  return `${baseUrl}${BOOKING_LINK_PREFIX}${bookingLink}`;
};

export const getBookingStatusUrl = (bookingId: string, request?: NextRequest): string => {
  const baseUrl = getBaseUrl(request);
  return `${baseUrl}/booking/${bookingId}`;
};
