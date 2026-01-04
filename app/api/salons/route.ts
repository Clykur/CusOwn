import { NextRequest } from 'next/server';
import { salonService } from '@/services/salon.service';
import { validateCreateSalon, validateTimeRange } from '@/lib/utils/validation';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { getBookingUrl } from '@/lib/utils/url';
import { generateQRCodeForBookingLink } from '@/lib/utils/qrcode';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getUserFriendlyError } from '@/lib/utils/error-handler';
import { SUCCESS_MESSAGES, ERROR_MESSAGES } from '@/config/constants';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = validateCreateSalon(body);

    validateTimeRange(validatedData.opening_time, validatedData.closing_time);

    const salon = await salonService.createSalon(validatedData);

    // Generate QR code immediately after salon creation
    let qrCode: string | null = null;
    try {
      qrCode = await generateQRCodeForBookingLink(salon.booking_link);
      
      // Update salon with QR code
      const { error: updateError } = await supabaseAdmin
        .from('businesses')
        .update({ qr_code: qrCode })
        .eq('id', salon.id);
      
      if (updateError) {
        // Log error but don't fail the response if QR code save fails
        // QR code can be generated later via API endpoint
      }
    } catch (qrError) {
      // Log error but don't fail the response if QR code generation fails
      // QR code can be generated later via API endpoint
    }

    return successResponse(
      {
        ...salon,
        booking_url: getBookingUrl(salon.booking_link),
        qr_code: qrCode,
      },
      SUCCESS_MESSAGES.SALON_CREATED
    );
  } catch (error) {
    // Convert technical errors to user-friendly messages
    const friendlyMessage = getUserFriendlyError(error);
    return errorResponse(friendlyMessage, 400);
  }
}

