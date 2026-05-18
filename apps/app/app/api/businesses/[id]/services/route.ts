import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  isValidUUID,
  serviceService,
  enhancedRateLimit,
  dedupe,
} from '@cusown/shared/server';

const servicesRateLimit = enhancedRateLimit({
  maxRequests: 50,
  windowMs: 60000,
  perIP: true,
  keyPrefix: 'services',
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rateLimitResponse = await servicesRateLimit(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const { id: businessId } = await params;
    if (!isValidUUID(businessId)) {
      return errorResponse('Invalid business ID', 400);
    }

    const activeOnly = request.nextUrl.searchParams.get('active_only') !== 'false';
    const services = await dedupe(`services:${businessId}:${activeOnly}`, () =>
      serviceService.getServicesByBusiness(businessId, activeOnly)
    );

    return successResponse(services);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch services';
    return errorResponse(message, 500);
  }
}
