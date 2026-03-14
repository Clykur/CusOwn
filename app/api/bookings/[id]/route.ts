import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { bookingService } from '@/services/booking.service';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { isValidUUID, validateResourceToken } from '@/lib/utils/security';
import {
  ERROR_MESSAGES,
  UI_ERROR_CONTEXT,
  SECURE_LINK_RESPONSE_CODE,
  RATE_LIMIT_ACTION_LINK_WINDOW_MS,
  RATE_LIMIT_ACTION_LINK_MAX_PER_WINDOW,
  CACHE_TTL_BOOKING_MS,
} from '@/config/constants';
import { getAuthContext } from '@/lib/utils/api-auth-pipeline';
import { userService } from '@/services/user.service';
import { isAdminProfile } from '@/lib/utils/role-verification';
import { logAuthDeny } from '@/lib/monitoring/auth-audit';
import { validateOwnerActionLink } from '@/lib/utils/secure-link-validation.server';
import { enhancedRateLimit } from '@/lib/security/rate-limit-api.security';
import {
  buildApiCacheKey,
  getCachedApiResponse,
  setCachedApiResponse,
} from '@/lib/cache/api-response-cache';
import { dedupe } from '@/lib/cache/request-dedup';
import { runWithTiming } from '@/lib/monitoring/performance';

const ROUTE = 'GET /api/bookings/[id]';

const getBookingWithTokenRateLimit = enhancedRateLimit({
  maxRequests: RATE_LIMIT_ACTION_LINK_MAX_PER_WINDOW,
  windowMs: RATE_LIMIT_ACTION_LINK_WINDOW_MS,
  perIP: true,
  keyPrefix: 'booking_get_token',
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await bookingService.runLazyExpireIfNeeded();

    const { id } = await params;
    if (!id || !isValidUUID(id)) {
      return errorResponse(ERROR_MESSAGES.BOOKING_NOT_FOUND, 404);
    }

    const token = request.nextUrl.searchParams.get('token');
    if (token) {
      const rateLimitResponse = await getBookingWithTokenRateLimit(request);
      if (rateLimitResponse) return rateLimitResponse;
      const decodedToken = (() => {
        try {
          return decodeURIComponent(token);
        } catch {
          return token;
        }
      })();
      const statusValid = validateResourceToken('booking-status', id, decodedToken);
      if (!statusValid) {
        // Parallel: validate both action link types simultaneously
        const [acceptValid, rejectValid] = await Promise.all([
          validateOwnerActionLink('accept', id, decodedToken),
          validateOwnerActionLink('reject', id, decodedToken),
        ]);

        if (!acceptValid.valid && !rejectValid.valid) {
          const reason = acceptValid.valid === false ? acceptValid.reason : 'invalid';
          logAuthDeny({
            route: ROUTE,
            reason: 'auth_invalid_token',
            resource: id,
            audit_metadata: { link_validation_reason: reason },
          });
          return NextResponse.json(
            {
              success: false,
              error: UI_ERROR_CONTEXT.ACCEPT_REJECT_PAGE,
              code: SECURE_LINK_RESPONSE_CODE,
            },
            { status: 403 }
          );
        }
      }
    }

    const cacheKey = buildApiCacheKey('GET', `/api/bookings/${id}`);
    const cached = getCachedApiResponse<{ data: unknown }>(cacheKey);
    type BookingWithDetails = Awaited<
      ReturnType<typeof bookingService.getBookingByUuidWithDetails>
    >;

    // Parallel: fetch booking and auth context simultaneously
    const bookingPromise = cached
      ? Promise.resolve(cached.data as BookingWithDetails)
      : dedupe(`booking:${id}`, () =>
          runWithTiming(
            `getBookingWithDetails:${id}`,
            () => bookingService.getBookingByUuidWithDetails(id),
            { route: ROUTE }
          )
        );

    const [booking, ctx] = await Promise.all([bookingPromise, getAuthContext(request)]);

    if (!booking) {
      return errorResponse(ERROR_MESSAGES.BOOKING_NOT_FOUND, 404);
    }
    if (!cached) {
      setCachedApiResponse(cacheKey, { data: booking }, CACHE_TTL_BOOKING_MS);
    }

    if (ctx) {
      const isCustomer =
        (booking as { customer_user_id?: string }).customer_user_id === ctx.user.id;
      let isOwner = false;
      const businessId = (booking as { business_id?: string }).business_id;
      if (businessId) {
        const userBusinesses = await userService.getUserBusinesses(ctx.user.id);
        isOwner = userBusinesses.some((b) => b.id === businessId);
      }
      const isAdmin = isAdminProfile(ctx.profile);
      if (!isCustomer && !isOwner && !isAdmin && !token) {
        logAuthDeny({
          user_id: ctx.user.id,
          route: ROUTE,
          reason: 'auth_denied',
          role: (ctx.profile as { user_type?: string } | null)?.user_type ?? 'unknown',
          resource: id,
        });
        return errorResponse('Access denied', 403);
      }
    } else if (!token) {
      logAuthDeny({ route: ROUTE, reason: 'auth_missing', resource: id });
      return errorResponse('Authentication required', 401);
    }

    return successResponse(booking);
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}
