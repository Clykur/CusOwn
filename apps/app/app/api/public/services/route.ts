import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@cusown/shared/server';
import { isValidUUID } from '@cusown/shared/server';
import { serviceService } from '@cusown/shared/server';
import { enhancedRateLimit } from '@cusown/shared/server';
import { dedupe } from '@cusown/shared/server';
import { API_REDIS_TTL } from '@cusown/shared/server';
import { getApiRedisCache, setApiRedisCache } from '@cusown/shared/server';
const publicServicesRateLimit = enhancedRateLimit({
  maxRequests: 100,
  windowMs: 60000,
  perIP: true,
  keyPrefix: 'public-services',
});
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await publicServicesRateLimit(request);
    if (rateLimitResponse) return rateLimitResponse;
    const businessId = request.nextUrl.searchParams.get('businessId');
    if (!businessId || !isValidUUID(businessId)) {
      return errorResponse('Valid businessId query parameter required', 400);
    }
    const activeOnly = request.nextUrl.searchParams.get('active_only') !== 'false';

    const cacheKey = `services:public:${businessId}:${activeOnly}`;

    // Check Redis cache
    const cached = await getApiRedisCache(cacheKey);
    if (cached) {
      const data = typeof cached === 'string' ? JSON.parse(cached) : cached;
      return successResponse(data);
    }
    // Fetch with dedupe
    const services = await dedupe(cacheKey, () =>
      serviceService.getServicesByBusiness(businessId, activeOnly)
    );
    // Cache result
    await setApiRedisCache(cacheKey, JSON.stringify(services), API_REDIS_TTL.SERVICES);
    return successResponse(services);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch public services';
    console.error('[public-services] Error:', error);
    return errorResponse(message, 500);
  }
}
