import { NextRequest } from 'next/server';
import { 
  salonService,
  validateCreateSalon,
  validateTimeRange,
  successResponse,
  errorResponse,
  getBookingUrl,
  generateQRCodeForBookingLink,
  getServerUser,
  userService,
  getUserFriendlyError,
  setNoCacheHeaders,
  getClientIp,
  auditService,
  getAllowedCategoryValues,
  filterFields,
  enhancedRateLimit,
} from '@cusown/shared/server';
import { SUCCESS_MESSAGES } from '@cusown/config';

export async function POST(request: NextRequest) {
  const clientIP = getClientIp(request);

  try {
    const rateLimitResponse = await enhancedRateLimit({
      maxRequests: 5,
      windowMs: 60000,
      perIP: true,
      perUser: true,
      keyPrefix: 'salon_create',
    })(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body = await request.json();

    const filteredBody = filterFields(body, [
      'salon_name',
      'owner_name',
      'whatsapp_number',
      'opening_time',
      'closing_time',
      'slot_duration',
      'address',
      'location',
      'category',
      'city',
      'area',
      'pincode',
      'latitude',
      'longitude',
      'concurrent_booking_capacity',
      'address_line1',
      'address_line2',
      'state',
      'country',
      'postal_code',
      'weekly_hours',
      'breaks',
      'holidays',
      'closures',
      'services',
    ] as const);

    // Validate using schema (already has length/format checks)
    const validatedData = validateCreateSalon(filteredBody);

    validateTimeRange(validatedData.opening_time, validatedData.closing_time);

    const category = validatedData.category ?? 'salon';
    const allowedCategories = await getAllowedCategoryValues();
    if (allowedCategories.length && !allowedCategories.includes(category)) {
      return errorResponse('Invalid business type. Please choose from the list.', 400);
    }

    // SECURITY: Require authentication for salon creation
    const user = await getServerUser(request);
    if (!user) {
      console.warn(`[SECURITY] Unauthenticated salon creation attempt from IP: ${clientIP}`);
      return errorResponse('Authentication required', 401);
    }

    // SECURITY: Verify user has owner access (or will be granted it)
    // This ensures only users who can be owners can create businesses
    const profile = await userService.getUserProfile(user.id);

    let ownerUserId: string = user.id;

    // Update user type to owner or both.
    // ALWAYS call updateUserType to ensure user_roles table is synchronized.
    const targetType = (profile?.user_type === 'customer' || profile?.user_type === 'both') ? 'both' : 'owner';
    await userService.updateUserType(user.id, targetType);

    const salon = await salonService.createSalon(validatedData, ownerUserId);

    // SECURITY: Log mutation for audit
    try {
      await auditService.createAuditLog(user.id, 'business_created', 'business', {
        entityId: salon.id,
        description: `Business created: ${salon.salon_name}`,
        request,
      });
    } catch (auditError) {
      console.error('[SECURITY] Failed to create audit log:', auditError);
    }

    // Generate QR code immediately after salon creation
    let qrCode: string | null = null;
    try {
      qrCode = await generateQRCodeForBookingLink(salon.booking_link, request);

      // Update salon with QR code using standardized service
      if (qrCode) {
        await salonService.updateSalon(salon.id, { qr_code: qrCode });
      }
    } catch (qrError) {
      console.error('[BUSINESS] QR code generation failed:', qrError);
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
