import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { downtimeService } from '@/services/downtime.service';
import { enhancedRateLimit } from '@/lib/security/rate-limit-api.security';
import { isValidUUID } from '@/lib/utils/security';
import { dedupe } from '@/lib/cache/request-dedup';

const downtimeRateLimit = enhancedRateLimit({
  maxRequests: 100,
  windowMs: 60000,
  perIP: true,
  keyPrefix: 'downtime',
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rateLimitResponse = await downtimeRateLimit(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const { id: businessId } = await params;
    if (!isValidUUID(businessId)) {
      return errorResponse('Invalid business ID', 400);
    }

    const holidays = await dedupe(`holidays:${businessId}`, () =>
      downtimeService.getBusinessHolidays(businessId)
    );

    return successResponse(holidays);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch holidays';
    return errorResponse(message, 500);
  }
}
