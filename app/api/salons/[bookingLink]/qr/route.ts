import { NextRequest, NextResponse } from 'next/server';
import { salonService } from '@/services/salon.service';
import { generateQRCodeForBookingLink } from '@/lib/utils/qrcode';
import { supabaseAdmin } from '@/lib/supabase/server';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { isValidUUID } from '@/lib/utils/security';
import { ERROR_MESSAGES } from '@/config/constants';
import { setCacheHeaders } from '@/lib/cache/next-cache';

/**
 * GET /api/salons/[bookingLink]/qr
 * Generate or retrieve QR code for a salon.
 * Use ?regenerate=1 to force a new QR (e.g. after fixing production URL).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bookingLink: string }> }
) {
  try {
    const { bookingLink } = await params;
    const regenerate = request.nextUrl.searchParams.get('regenerate') === '1';

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

    if (salon.qr_code && !regenerate) {
      const response = NextResponse.json(successResponse({ qr_code: salon.qr_code }));
      setCacheHeaders(response, 86400, 172800);
      return response;
    }

    // Generate QR code if it doesn't exist
    try {
      const qrCode = await generateQRCodeForBookingLink(salon.booking_link, request);

      // Update salon with QR code
      if (!supabaseAdmin) {
        throw new Error('Supabase admin client not configured');
      }
      const { error: updateError } = await supabaseAdmin
        .from('businesses')
        .update({ qr_code: qrCode })
        .eq('id', salon.id);

      if (updateError) {
        throw new Error('Failed to save QR code');
      }

      const response = successResponse({ qr_code: qrCode });
      setCacheHeaders(response, 86400, 172800);
      return response;
    } catch (qrError) {
      return errorResponse('Failed to generate QR code', 500);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}
