import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { isValidUUID } from '@/lib/utils/security';
import { serviceService } from '@/services/service.service';
import { enhancedRateLimit } from '@/lib/security/rate-limit-api.security';

const servicesRateLimit = enhancedRateLimit({
  maxRequests: 50,
  windowMs: 60000,
  perIP: true,
  keyPrefix: 'services',
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const rateLimitResponse = await servicesRateLimit(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const businessId = params.id;
    if (!isValidUUID(businessId)) {
      return errorResponse('Invalid business ID', 400);
    }

    const activeOnly = request.nextUrl.searchParams.get('active_only') !== 'false';
    const services = await serviceService.getServicesByBusiness(businessId, activeOnly);

    return successResponse(services);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch services';
    return errorResponse(message, 500);
  }
}
