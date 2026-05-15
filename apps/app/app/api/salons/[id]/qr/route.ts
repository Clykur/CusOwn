import { NextRequest } from 'next/server';
import { 
  salonService,
  generateQRCodeForBookingLink,
  successResponse,
  errorResponse,
  isValidUUID,
  setCacheHeaders,
  getUserFriendlyError
} from '@cusown/shared/server';
import { ERROR_MESSAGES } from '@cusown/config';

/**
 * GET /api/salons/[id]/qr
 * Generate or retrieve QR code for a salon.
 * Use ?regenerate=1 to force a new QR (e.g. after fixing production URL).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const regenerate = request.nextUrl.searchParams.get('regenerate') === '1';

    if (!id) {
      return errorResponse(ERROR_MESSAGES.SALON_NOT_FOUND, 404);
    }

    // Get salon by booking link
    const isUUID = isValidUUID(id);
    const salon = isUUID
      ? await salonService.getSalonById(id)
      : await salonService.getSalonByBookingLink(id);

    if (!salon) {
      return errorResponse(ERROR_MESSAGES.SALON_NOT_FOUND, 404);
    }

    if (salon.qr_code && !regenerate) {
      const response = successResponse({ qr_code: salon.qr_code });
      setCacheHeaders(response, 86400, 172800);
      return response;
    }

    // Generate QR code if it doesn't exist
    try {
      const qrCode = await generateQRCodeForBookingLink(salon.booking_link, request);

      // Update salon with QR code using standardized service
      if (qrCode) {
        await salonService.updateSalon(salon.id, { qr_code: qrCode });
      }

      const response = successResponse({ qr_code: qrCode });
      setCacheHeaders(response, 86400, 172800);
      return response;
    } catch (qrError) {
      console.error('[QR] Generation error:', qrError);
      return errorResponse('Failed to generate QR code', 500);
    }
  } catch (error) {
    const friendlyMessage = getUserFriendlyError(error);
    return errorResponse(friendlyMessage, 500);
  }
}
