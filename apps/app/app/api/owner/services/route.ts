import { NextRequest } from "next/server";
import {
  successResponse,
  errorResponse,
  isValidUUID,
  serviceService,
  salonService,
  enhancedRateLimit,
  dedupe,
  buildApiCacheKey,
  getCachedApiResponse,
  setCachedApiResponse,
  API_CACHE_TTL,
  requireOwner,
  auditService,
  invalidateApiCacheByPrefix,
} from "@cusown/shared/server";
import { ERROR_MESSAGES } from "@cusown/config";

/**
 * RATE LIMIT (GET ONLY)
 */
const servicesListRateLimit = enhancedRateLimit({
  maxRequests: 50,
  windowMs: 60000,
  perIP: true,
  keyPrefix: "services-list",
});

/**
 * GET (OWNER + CUSTOMER)
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await servicesListRateLimit(request);
    if (rateLimitResponse) return rateLimitResponse;

    const businessId = request.nextUrl.searchParams.get("businessId");
    const bookingLink = request.nextUrl.searchParams.get("bookingLink");

    if (businessId && bookingLink) {
      return errorResponse(
        "Provide either businessId or bookingLink, not both",
        400,
      );
    }

    /**
     * =========================
     * OWNER FLOW (AUTH REQUIRED)
     * =========================
     */
    if (businessId) {
      const auth = await requireOwner(request, "GET /api/owner/services");
      if (auth instanceof Response) return auth;

      if (!isValidUUID(businessId)) {
        return errorResponse("Invalid businessId", 400);
      }

      const salon = await salonService.getSalonById(businessId);

      if (!salon) {
        return errorResponse("Business not found", 404);
      }

      if (salon.owner_user_id !== auth.user.id) {
        return errorResponse("Unauthorized", 403);
      }

      const activeOnly =
        request.nextUrl.searchParams.get("active_only") !== "false";
      const cacheKey = buildApiCacheKey(
        "GET",
        "/api/owner/services",
        request.nextUrl.searchParams,
        auth.user.id,
      );

      const cached = getCachedApiResponse<any[]>(cacheKey);
      if (cached) return successResponse(cached);

      const services = await dedupe(cacheKey, () =>
        serviceService.getServicesByBusiness(businessId, activeOnly),
      );

      setCachedApiResponse(cacheKey, services, API_CACHE_TTL.DEFAULT);
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
        return errorResponse("Business not found", 404);
      }

      const cacheKey = buildApiCacheKey("GET", "/api/owner/services", {
        bookingLink,
      });
      const cached = getCachedApiResponse<any[]>(cacheKey);
      if (cached) return successResponse(cached);

      const services = await dedupe(
        cacheKey,
        () => serviceService.getServicesByBusiness(salon.id, true), // only active
      );

      setCachedApiResponse(cacheKey, services, API_CACHE_TTL.DEFAULT);
      return successResponse(services);
    }

    return errorResponse(
      "Provide businessId (owner) or bookingLink (customer)",
      400,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}

/**
 * POST (CREATE SERVICE)
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireOwner(request, "POST /api/owner/services");
    if (auth instanceof Response) return auth;

    const { businessId, name, duration_minutes, price_cents } =
      await request.json();

    if (!isValidUUID(businessId)) {
      return errorResponse("Invalid businessId", 400);
    }

    if (!name?.trim()) return errorResponse("Service name required", 400);
    if (!duration_minutes || duration_minutes <= 0)
      return errorResponse("Invalid duration", 400);
    if (!price_cents || price_cents <= 0)
      return errorResponse("Invalid price", 400);

    const salon = await salonService.getSalonById(businessId);
    if (!salon) {
      return errorResponse("Business not found", 404);
    }

    if (salon.owner_user_id !== auth.user.id) {
      return errorResponse("Unauthorized", 403);
    }

    const service = await serviceService.createService({
      business_id: businessId,
      name: name.trim(),
      duration_minutes,
      price_cents,
      is_active: true,
    });

    // Invalidate cache
    invalidateApiCacheByPrefix("GET|/api/owner/services");

    // Create audit log
    await auditService.createAuditLog(
      auth.user.id,
      "service_created",
      "service",
      {
        entityId: service.id,
        newData: service,
        description: `Service "${name}" created by owner`,
      },
    );

    return successResponse(service);
  } catch (error) {
    return errorResponse("Failed to create service", 500);
  }
}

/**
 * PUT (UPDATE SERVICE)
 */
export async function PUT(request: NextRequest) {
  try {
    const auth = await requireOwner(request, "PUT /api/owner/services");
    if (auth instanceof Response) return auth;

    const { serviceId, name, duration_minutes, price_cents, is_active } =
      await request.json();

    if (!isValidUUID(serviceId)) {
      return errorResponse("Invalid serviceId", 400);
    }

    const oldService = await serviceService.getServiceById(serviceId);
    if (!oldService) return errorResponse("Service not found", 404);

    const salon = await salonService.getSalonById(oldService.business_id);
    if (!salon) {
      return errorResponse("Business not found", 404);
    }

    if (salon.owner_user_id !== auth.user.id) {
      return errorResponse("Unauthorized", 403);
    }

    const updated = await serviceService.updateService(serviceId, {
      name,
      duration_minutes,
      price_cents,
      is_active,
    });

    // Invalidate cache
    invalidateApiCacheByPrefix("GET|/api/owner/services");

    // Create audit log
    await auditService.createAuditLog(
      auth.user.id,
      "service_updated",
      "service",
      {
        entityId: serviceId,
        oldData: oldService,
        newData: updated,
        description: `Service "${name || oldService.name}" updated by owner`,
      },
    );

    return successResponse(updated);
  } catch (error) {
    return errorResponse("Failed to update service", 500);
  }
}

/**
 * DELETE (SOFT DELETE)
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireOwner(request, "DELETE /api/owner/services");
    if (auth instanceof Response) return auth;

    const serviceId = request.nextUrl.searchParams.get("serviceId");

    if (!serviceId || !isValidUUID(serviceId)) {
      return errorResponse("Invalid serviceId", 400);
    }

    const service = await serviceService.getServiceById(serviceId);
    if (!service) return errorResponse("Service not found", 404);

    const salon = await salonService.getSalonById(service.business_id);
    if (!salon) {
      return errorResponse("Business not found", 404);
    }

    if (salon.owner_user_id !== auth.user.id) {
      return errorResponse("Unauthorized", 403);
    }

    await serviceService.updateService(serviceId, {
      is_active: false,
    });

    // Invalidate cache
    invalidateApiCacheByPrefix("GET|/api/owner/services");

    // Create audit log
    await auditService.createAuditLog(
      auth.user.id,
      "service_deleted",
      "service",
      {
        entityId: serviceId,
        description: `Service "${service.name}" soft-deleted (deactivated) by owner`,
      },
    );

    return successResponse({ success: true });
  } catch (error) {
    return errorResponse("Failed to delete service", 500);
  }
}
