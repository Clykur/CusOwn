import { NextRequest } from 'next/server';
import { slotService } from '@/services/slot.service';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { ERROR_MESSAGES } from '@/config/constants';
import { getClientIp, isValidUUID } from '@/lib/utils/security';
import { enhancedRateLimit } from '@/lib/security/rate-limit-api.security';

const releaseRateLimit = enhancedRateLimit({
  maxRequests: 20,
  windowMs: 60000,
  perIP: true,
  keyPrefix: 'slot_release',
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slotId: string }> }
) {
  const clientIP = getClientIp(request);

  try {
    const rateLimitResponse = await releaseRateLimit(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const { slotId } = await params;

    if (!isValidUUID(slotId)) {
      console.warn(`[SECURITY] Invalid slot ID format from IP: ${clientIP}`);
      return errorResponse('Invalid slot ID', 400);
    }

    // Note: Slot release is intentionally public for booking flow
    // Rate limiting provides protection
    // RLS policies on slots table will enforce data integrity

    await slotService.releaseSlot(slotId);

    console.log(`[SECURITY] Slot released: IP: ${clientIP}, Slot: ${slotId.substring(0, 8)}...`);
    return successResponse({ slot_id: slotId }, 'Slot released successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    console.error(`[SECURITY] Slot release error: IP: ${clientIP}, Error: ${message}`);
    return errorResponse(message, 500);
  }
}
