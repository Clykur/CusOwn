import { getBookingUrl } from './url';
import { NextRequest } from 'next/server';

/**
 * Generate QR code data URL for a booking link
 * This will be used on the server side to generate QR codes
 */
export const generateQRCodeDataUrl = async (bookingUrl: string): Promise<string> => {
  // Dynamic import to avoid SSR issues
  const QRCode = (await import('qrcode')).default;

  try {
    // Generate QR code as data URL (base64 image)
    const qrCodeDataUrl = await QRCode.toDataURL(bookingUrl, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });

    return qrCodeDataUrl;
  } catch (error) {
    throw new Error(
      `Failed to generate QR code: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
};

/**
 * Generate QR code for a booking link
 * Returns base64 encoded image string
 * @param bookingLink - The booking link identifier
 * @param request - Optional NextRequest for proper URL generation (production vs dev)
 */
export const generateQRCodeForBookingLink = async (
  bookingLink: string,
  request?: NextRequest
): Promise<string> => {
  const bookingUrl = getBookingUrl(bookingLink, request);
  return generateQRCodeDataUrl(bookingUrl);
};
