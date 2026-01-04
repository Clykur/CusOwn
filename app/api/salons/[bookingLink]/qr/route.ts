import { NextRequest } from 'next/server';
import { salonService } from '@/services/salon.service';
import { generateQRCodeForBookingLink } from '@/lib/utils/qrcode';
import { supabaseAdmin } from '@/lib/supabase/server';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { isValidUUID } from '@/lib/utils/security';
import { ERROR_MESSAGES } from '@/config/constants';

/**
 * GET /api/salons/[bookingLink]/qr
 * Generate or retrieve QR code for a salon
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { bookingLink: string } }
) {
  try {
    const { bookingLink } = params;

    if (!bookingLink) {
      return errorResponse(ERROR_MESSAGES.SALON_NOT_FOUND, 404);
    }

    // Get salon by booking link
    const isUUID = isValidUUID(bookingLink);
    const salon = isUUID
      ? await salonService.getSalonById(bookingLink)
      : await salonService.getSalonByBookingLink(bookingLink);

    if (!salon) {
      return errorResponse(ERROR_MESSAGES.SALON_NOT_FOUND, 404);
    }

    // If QR code already exists, return it
    if (salon.qr_code) {
      return successResponse({ qr_code: salon.qr_code });
    }

    // Generate QR code if it doesn't exist
    try {
      const qrCode = await generateQRCodeForBookingLink(salon.booking_link);
      
      // Update salon with QR code
      const { error: updateError } = await supabaseAdmin
        .from('businesses')
        .update({ qr_code: qrCode })
        .eq('id', salon.id);
      
      if (updateError) {
        throw new Error('Failed to save QR code');
      }

      return successResponse({ qr_code: qrCode });
    } catch (qrError) {
      return errorResponse('Failed to generate QR code', 500);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}

