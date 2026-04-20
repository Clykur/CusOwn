import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { isValidUUID } from '@/lib/utils/security';
import { serviceService } from '@/services/service.service';
import { salonService } from '@/services/salon.service';
import { enhancedRateLimit } from '@/lib/security/rate-limit-api.security';
import { dedupe } from '@/lib/cache/request-dedup';
import { ERROR_MESSAGES } from '@/config/constants';
import { getApiRedisCache, setApiRedisCache, API_REDIS_TTL } from '@/lib/cache/api-redis-cache';
import { getServerUser } from '@/lib/auth/get-server-user';

/**
 * RATE LIMIT (GET ONLY)
 */
const servicesListRateLimit = enhancedRateLimit({
  maxRequests: 50,
  windowMs: 60000,
  perIP: true,
  keyPrefix: 'services-list',
});

/**
 * GET (OWNER + CUSTOMER)
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await servicesListRateLimit(request);
    if (rateLimitResponse) return rateLimitResponse;

    const businessId = request.nextUrl.searchParams.get('businessId');
    const bookingLink = request.nextUrl.searchParams.get('bookingLink');

    if (businessId && bookingLink) {
      return errorResponse('Provide either businessId or bookingLink, not both', 400);
    }

    /**
     * =========================
     * OWNER FLOW (AUTH REQUIRED)
     * =========================
     */
    if (businessId) {
      const user = await getServerUser();

      if (!user) {
        return errorResponse('Unauthorized', 401);
      }

      if (!isValidUUID(businessId)) {
        return errorResponse('Invalid businessId', 400);
      }

      const salon = await salonService.getSalonById(businessId);

      if (!salon) {
        return errorResponse('Business not found', 404);
      }

      if (salon.owner_user_id !== user.id) {
        return errorResponse('Unauthorized', 403);
      }

      const activeOnly = request.nextUrl.searchParams.get('active_only') !== 'false';

      const cacheKey = `services:owner:${businessId}:${activeOnly}`;

      const cached = await getApiRedisCache(cacheKey);
      if (cached) return successResponse(cached);

      const services = await dedupe(cacheKey, () =>
        serviceService.getServicesByBusiness(businessId, activeOnly)
      );

      await setApiRedisCache(cacheKey, services, API_REDIS_TTL.SERVICES);

      return successResponse(services);
    }

    /**
     * =========================
     * CUSTOMER FLOW (NO AUTH)
     * =========================
     */
    if (bookingLink) {
      const salon = await salonService.getSalonByBookingLink(bookingLink);

      if (!salon) {
        return errorResponse('Business not found', 404);
      }

      const cacheKey = `services:public:${bookingLink}`;

      const cached = await getApiRedisCache(cacheKey);
      if (cached) return successResponse(cached);

      const services = await dedupe(
        cacheKey,
        () => serviceService.getServicesByBusiness(salon.id, true) // only active
      );

      await setApiRedisCache(cacheKey, services, API_REDIS_TTL.SERVICES);

      return successResponse(services);
    }

    return errorResponse('Provide businessId (owner) or bookingLink (customer)', 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;

    return errorResponse(message, 500);
  }
}

/**
 * POST (CREATE SERVICE)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getServerUser();

    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    const { businessId, name, duration_minutes, price_cents } = await request.json();

    if (!isValidUUID(businessId)) {
      return errorResponse('Invalid businessId', 400);
    }

    if (!name?.trim()) return errorResponse('Service name required', 400);
    if (!duration_minutes || duration_minutes <= 0) return errorResponse('Invalid duration', 400);
    if (!price_cents || price_cents <= 0) return errorResponse('Invalid price', 400);

    const salon = await salonService.getSalonById(businessId);

    if (!salon) {
      return errorResponse('Business not found', 404);
    }

    if (salon.owner_user_id !== user.id) {
      return errorResponse('Unauthorized', 403);
    }

    const service = await serviceService.createService({
      business_id: businessId,
      name: name.trim(),
      duration_minutes,
      price_cents,
      is_active: true,
    });

    // invalidate ALL related cache keys
    await setApiRedisCache(`services:owner:${businessId}:true`, null, 0);
    await setApiRedisCache(`services:owner:${businessId}:false`, null, 0);

    return successResponse(service);
  } catch (error) {
    return errorResponse('Failed to create service', 500);
  }
}

/**
 * PUT (UPDATE SERVICE)
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await getServerUser();

    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    const { serviceId, name, duration_minutes, price_cents, is_active } = await request.json();

    if (!isValidUUID(serviceId)) {
      return errorResponse('Invalid serviceId', 400);
    }

    const service = await serviceService.getServiceById(serviceId);
    if (!service) return errorResponse('Service not found', 404);

    const salon = await salonService.getSalonById(service.business_id);

    // ✅ FIXED (your TS error)
    if (!salon) {
      return errorResponse('Business not found', 404);
    }

    if (salon.owner_user_id !== user.id) {
      return errorResponse('Unauthorized', 403);
    }

    const updated = await serviceService.updateService(serviceId, {
      name,
      duration_minutes,
      price_cents,
      is_active,
    });

    // invalidate cache
    await setApiRedisCache(`services:owner:${service.business_id}:true`, null, 0);
    await setApiRedisCache(`services:owner:${service.business_id}:false`, null, 0);

    return successResponse(updated);
  } catch (error) {
    return errorResponse('Failed to update service', 500);
  }
}

/**
 * DELETE (SOFT DELETE)
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await getServerUser();

    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    const serviceId = request.nextUrl.searchParams.get('serviceId');

    if (!serviceId || !isValidUUID(serviceId)) {
      return errorResponse('Invalid serviceId', 400);
    }

    const service = await serviceService.getServiceById(serviceId);
    if (!service) return errorResponse('Service not found', 404);

    const salon = await salonService.getSalonById(service.business_id);

    // ✅ FIXED (your TS error)
    if (!salon) {
      return errorResponse('Business not found', 404);
    }

    if (salon.owner_user_id !== user.id) {
      return errorResponse('Unauthorized', 403);
    }

    await serviceService.updateService(serviceId, {
      is_active: false,
    });

    // invalidate cache
    await setApiRedisCache(`services:owner:${service.business_id}:true`, null, 0);
    await setApiRedisCache(`services:owner:${service.business_id}:false`, null, 0);

    return successResponse({ success: true });
  } catch (error) {
    return errorResponse('Failed to delete service', 500);
  }
}
