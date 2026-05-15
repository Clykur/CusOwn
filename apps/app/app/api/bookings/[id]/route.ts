import { NextRequest, NextResponse } from 'next/server';
import { 
  bookingService, 
  successResponse, 
  errorResponse, 
  isValidUUID, 
  validateResourceToken,
  getAuthContext,
  userService,
  isAdminProfile,
  logAuthDeny,
  validateOwnerActionLink,
  enhancedRateLimit,
  buildApiCacheKey,
  getCachedApiResponse,
  setCachedApiResponse,
  dedupe,
  runWithTiming,
  parseBookingActionQueryToken
} from '@cusown/shared/server';
import {
  ERROR_MESSAGES,
  UI_ERROR_CONTEXT,
  SECURE_LINK_RESPONSE_CODE,
  RATE_LIMIT_ACTION_LINK_WINDOW_MS,
  RATE_LIMIT_ACTION_LINK_MAX_PER_WINDOW,
  CACHE_TTL_BOOKING_MS,
} from '@cusown/config';

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

    const rateLimitResponse = await getBookingWithTokenRateLimit(request);
    if (rateLimitResponse) return rateLimitResponse;

    const tokenParse = parseBookingActionQueryToken(request);

    let decodedToken: string | null = null;
    let tokenValid = false;

    if (tokenParse.kind === 'malformed') {
      logAuthDeny({
        route: ROUTE,
        reason: 'auth_invalid_token',
        resource: id,
      });

      return NextResponse.json(
        {
          success: false,
          error: UI_ERROR_CONTEXT.ACCEPT_REJECT_PAGE,
          code: SECURE_LINK_RESPONSE_CODE,
        },
        { status: 400 }
      );
    }

    if (tokenParse.kind === 'present') {
      decodedToken = tokenParse.decoded;

      const statusValid = validateResourceToken('booking-status', id, decodedToken);

      if (statusValid) {
        tokenValid = true;
      } else {
        const [acceptValid, rejectValid] = await Promise.all([
          validateOwnerActionLink('accept', id, decodedToken),
          validateOwnerActionLink('reject', id, decodedToken),
        ]);

        if (acceptValid.valid || rejectValid.valid) {
          tokenValid = true;
        } else {
          logAuthDeny({
            route: ROUTE,
            reason: 'auth_invalid_token',
            resource: id,
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
      if (!isCustomer && !isOwner && !isAdmin && !tokenValid) {
        logAuthDeny({
          user_id: ctx.user.id,
          route: ROUTE,
          reason: 'auth_denied',
          role: (ctx.profile as { user_type?: string } | null)?.user_type ?? 'unknown',
          resource: id,
        });
        return errorResponse('Access denied', 403);
      }
    } else if (!tokenValid) {
      logAuthDeny({ route: ROUTE, reason: 'auth_missing', resource: id });
      return errorResponse('Authentication required', 401);
    }

    return successResponse(booking);
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}
