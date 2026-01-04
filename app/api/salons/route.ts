import { NextRequest } from 'next/server';
import { salonService } from '@/services/salon.service';
import { validateCreateSalon, validateTimeRange } from '@/lib/utils/validation';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { getBookingUrl } from '@/lib/utils/url';
import { generateQRCodeForBookingLink } from '@/lib/utils/qrcode';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getServerUser } from '@/lib/supabase/server-auth';
import { userService } from '@/services/user.service';
import { getUserFriendlyError } from '@/lib/utils/error-handler';
import { formatPhoneNumber } from '@/lib/utils/string';
import { SUCCESS_MESSAGES, ERROR_MESSAGES } from '@/config/constants';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = validateCreateSalon(body);

    validateTimeRange(validatedData.opening_time, validatedData.closing_time);

    // Get authenticated user (optional - for backward compatibility)
    const user = await getServerUser(request);
    let ownerUserId: string | undefined = undefined;

    if (user) {
      ownerUserId = user.id;
      // Update user type to owner or both (skip if admin)
      const profile = await userService.getUserProfile(user.id);
      if (profile) {
        // Don't change admin's role
        if (profile.user_type !== 'admin') {
          const newUserType = profile.user_type === 'customer' ? 'both' : profile.user_type === 'both' ? 'both' : 'owner';
          if (newUserType !== profile.user_type) {
            await userService.updateUserType(user.id, newUserType);
          }
        }
      } else {
        // Create profile as owner
        await userService.upsertUserProfile(user.id, {
          user_type: 'owner',
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || null,
        });
      }
    }

    // Check if user already has a business with this WhatsApp number
    if (user && ownerUserId) {
      if (!supabaseAdmin) {
        return errorResponse('Database not configured', 500);
      }
      const formattedPhone = formatPhoneNumber(validatedData.whatsapp_number);
      const { data: existingBusiness } = await supabaseAdmin
        .from('businesses')
        .select('id, booking_link, salon_name')
        .eq('whatsapp_number', formattedPhone)
        .eq('owner_user_id', ownerUserId)
        .single();

      if (existingBusiness) {
        // User already owns a business with this WhatsApp number
        return errorResponse(
          `You already have a business "${existingBusiness.salon_name}" with this WhatsApp number. Please use your existing booking link: /b/${existingBusiness.booking_link} or use a different WhatsApp number.`,
          409
        );
      }
    }

    const salon = await salonService.createSalon(validatedData, ownerUserId);

    // Generate QR code immediately after salon creation
    let qrCode: string | null = null;
    try {
      qrCode = await generateQRCodeForBookingLink(salon.booking_link);
      
      // Update salon with QR code
      if (!supabaseAdmin) {
        throw new Error('Database not configured');
      }
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

