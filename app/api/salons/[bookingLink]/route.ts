import { NextRequest } from 'next/server';
import { salonService } from '@/services/salon.service';
import { mediaService } from '@/services/media.service';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { getClientIp, isValidUUID, validateSalonToken } from '@/lib/utils/security';
import { ERROR_MESSAGES } from '@/config/constants';
import { setCacheHeaders } from '@/lib/cache/next-cache';
import { enhancedRateLimit } from '@/lib/security/rate-limit-api.security';
import { getServerUser } from '@/lib/supabase/server-auth';
import { env } from '@/config/env';

// Strict rate limiting for salon access: 30 requests per minute per IP
const salonAccessRateLimit = enhancedRateLimit({
  maxRequests: 30,
  windowMs: 60000,
  perIP: true,
  keyPrefix: 'salon_access',
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bookingLink: string }> }
) {
  try {
    // Apply rate limiting
    const rateLimitResponse = await salonAccessRateLimit(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const { bookingLink } = await params;
    const clientIP = getClientIp(request);

    if (!bookingLink) {
      console.warn(`[SECURITY] Missing booking link from IP: ${clientIP}`);
      return errorResponse(ERROR_MESSAGES.SALON_NOT_FOUND, 404);
    }

    // Check if it's a UUID (salon ID) or a booking link (slug)
    const isUUID = isValidUUID(bookingLink);

    // If it's a UUID, require token validation for security
    if (isUUID) {
      let token = request.nextUrl.searchParams.get('token');

      // Handle URL decoding
      if (token) {
        try {
          token = decodeURIComponent(token);
        } catch {
          // If decoding fails, use original token
        }
      }

      if (!token) {
        console.warn(
          `[SECURITY] Missing token for salon ID access from IP: ${clientIP}, Salon: ${bookingLink}`
        );
        return errorResponse('Invalid or missing access token', 403);
      }

      // Reject placeholder tokens and validate format (64 chars for new, 32/16 for legacy)
      if (
        token === 'pending' ||
        (!/^[0-9a-f]{64}$/i.test(token) &&
          !/^[0-9a-f]{32}$/i.test(token) &&
          !/^[0-9a-f]{16}$/i.test(token))
      ) {
        console.warn(
          `[SECURITY] Invalid token format from IP: ${clientIP}, Salon: ${bookingLink.substring(0, 8)}..., Token length: ${token.length}, Token preview: ${token.substring(0, 10)}...`
        );
        return errorResponse('Invalid access token format', 403);
      }

      const isValidToken = validateSalonToken(bookingLink, token);

      if (!isValidToken) {
        return errorResponse(
          'Invalid or expired access token. Please use a valid booking link.',
          403
        );
      }
    }

    let salon;
    if (isUUID) {
      salon = await salonService.getSalonById(bookingLink);
    } else {
      salon = await salonService.getSalonByBookingLink(bookingLink);
    }

    if (!salon) {
      console.warn(`[SECURITY] Salon not found from IP: ${clientIP}, Link: ${bookingLink}`);
      return errorResponse(ERROR_MESSAGES.SALON_NOT_FOUND, 404);
    }

    // SECURITY: For owner dashboard access via bookingLink (slug), ALWAYS verify ownership
    // This prevents unauthorized access to owner dashboards via guessable slugs
    if (!isUUID && salon) {
      // Check if this is an owner dashboard access attempt
      const referer = request.headers.get('referer') || '';
      const pathname = request.nextUrl.pathname || '';
      const isOwnerDashboardAccess = referer.includes('/owner/') || pathname.includes('/owner/');

      if (isOwnerDashboardAccess) {
        // Owner dashboard access requires authentication
        const user = await getServerUser(request);

        if (!user) {
          console.warn(
            `[SECURITY] Unauthenticated owner dashboard access attempt from IP: ${clientIP}, BookingLink: ${bookingLink}`
          );
          return errorResponse('Authentication required', 401);
        }

        // Verify ownership
        const { userService } = await import('@/services/user.service');
        const userBusinesses = await userService.getUserBusinesses(user.id);
        const hasAccess = userBusinesses.some(
          (b) => b.id === salon.id || b.booking_link === bookingLink
        );

        if (!hasAccess) {
          const profile = await userService.getUserProfile(user.id);
          const isAdmin = profile?.user_type === 'admin';
          if (!isAdmin) {
            console.warn(
              `[SECURITY] Unauthorized owner dashboard access from IP: ${clientIP}, User: ${user.id.substring(0, 8)}..., Business: ${salon.id.substring(0, 8)}..., BookingLink: ${bookingLink}`
            );
            return errorResponse('Access denied', 403);
          }
        }
      }
    }

    // Enrich with owner profile image for customer/owner UI (signed URL server-side)
    let payload: typeof salon & { owner_image?: string } = { ...salon };
    const ownerUserId = (salon as { owner_user_id?: string }).owner_user_id;
    if (ownerUserId) {
      try {
        const profileMedia = await mediaService.getProfileMedia(ownerUserId);
        if (profileMedia) {
          const signed = await mediaService.createSignedUrl(
            profileMedia.id,
            env.security.signedUrlTtlSeconds
          );
          if (signed?.url) payload.owner_image = signed.url;
        }
      } catch {
        // Omit owner_image on failure; owner_name still available
      }
    }

    const response = successResponse(payload);
    setCacheHeaders(response, 300, 600);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    console.error('[ERROR] Salon API error:', error);
    return errorResponse(message, 500);
  }
}
