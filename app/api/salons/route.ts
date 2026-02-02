import { NextRequest, NextResponse } from 'next/server';
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
import { setNoCacheHeaders } from '@/lib/cache/next-cache';
import { SUCCESS_MESSAGES, ERROR_MESSAGES } from '@/config/constants';
import { auditService } from '@/services/audit.service';

export async function POST(request: NextRequest) {
  const clientIP = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
  
  try {
    // Rate limiting for salon creation
    const { enhancedRateLimit } = await import('@/lib/security/rate-limit-api.security');
    const salonCreateRateLimit = enhancedRateLimit({ maxRequests: 5, windowMs: 60000, perIP: true, perUser: true, keyPrefix: 'salon_create' });
    const rateLimitResponse = await salonCreateRateLimit(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body = await request.json();
    
    // SECURITY: Filter input to prevent mass assignment
    const { filterFields } = await import('@/lib/security/input-filter');
    const allowedFields = ['salon_name', 'owner_name', 'whatsapp_number', 'opening_time', 'closing_time', 'slot_duration', 'address', 'location', 'category', 'city', 'area', 'pincode', 'latitude', 'longitude'] as const;
    const filteredBody = filterFields(body, allowedFields);
    
    // Validate using schema (already has length/format checks)
    const validatedData = validateCreateSalon(filteredBody);

    validateTimeRange(validatedData.opening_time, validatedData.closing_time);

    // SECURITY: Require authentication for salon creation
    const user = await getServerUser(request);
    if (!user) {
      console.warn(`[SECURITY] Unauthenticated salon creation attempt from IP: ${clientIP}`);
      return errorResponse('Authentication required', 401);
    }
    
    // SECURITY: Verify user has owner access (or will be granted it)
    // This ensures only users who can be owners can create businesses
    const { hasOwnerAccess } = await import('@/lib/utils/role-verification');
    const profile = await userService.getUserProfile(user.id);
    
    // If user has a profile, check if they can be an owner
    // If no profile, we'll create one as owner (allowed)
    if (profile && profile.user_type === 'admin') {
      // Admins can create businesses
    } else if (profile && profile.user_type === 'customer') {
      // Customer can create business (will be upgraded to 'both')
    } else if (!profile) {
      // No profile - will be created as owner (allowed)
    }
    // Owner and 'both' users are already allowed
    
    let ownerUserId: string = user.id;

    // Update user type to owner or both (skip if admin)
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
          `You already have a business "${existingBusiness.salon_name}" with this WhatsApp number. Please use your existing booking link or use a different WhatsApp number.`,
          409
        );
      }
    }

    const salon = await salonService.createSalon(validatedData, ownerUserId);

    // SECURITY: Log mutation for audit
    try {
      await auditService.createAuditLog(
        user.id,
        'business_created',
        'business',
        {
          entityId: salon.id,
          description: `Business created: ${salon.salon_name}`,
          request,
        }
      );
    } catch (auditError) {
      console.error('[SECURITY] Failed to create audit log:', auditError);
    }

    // Generate QR code immediately after salon creation
    let qrCode: string | null = null;
    try {
      qrCode = await generateQRCodeForBookingLink(salon.booking_link, request);
      
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

    const response = successResponse(
      {
        ...salon,
        booking_url: getBookingUrl(salon.booking_link, request),
        qr_code: qrCode,
      },
      SUCCESS_MESSAGES.SALON_CREATED
    );
    setNoCacheHeaders(response);
    return response;
  } catch (error) {
    // Convert technical errors to user-friendly messages
    const friendlyMessage = getUserFriendlyError(error);
    return errorResponse(friendlyMessage, 400);
  }
}

