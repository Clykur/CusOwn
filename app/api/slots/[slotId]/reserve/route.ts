import { NextRequest } from 'next/server';
import { slotService } from '@/services/slot.service';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '@/config/constants';
import { getClientIp, isValidUUID } from '@/lib/utils/security';
import { enhancedRateLimit } from '@/lib/security/rate-limit-api.security';
import { abuseDetectionService } from '@/lib/security/abuse-detection';
import { getServerUser } from '@/lib/supabase/server-auth';

const reserveRateLimit = enhancedRateLimit({
  maxRequests: 20,
  windowMs: 60000,
  perIP: true,
  keyPrefix: 'slot_reserve',
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slotId: string }> }
) {
  const clientIP = getClientIp(request);

  try {
    const rateLimitResponse = await reserveRateLimit(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const { slotId } = await params;

    if (!isValidUUID(slotId)) {
      console.warn(`[SECURITY] Invalid slot ID format from IP: ${clientIP}`);
      return errorResponse('Invalid slot ID', 400);
    }

    const user = await getServerUser(request);
    const userId = user?.id || null;

    const abuseCheck = await abuseDetectionService.shouldBlockAction(userId, clientIP, 'reserve');
    if (abuseCheck.blocked) {
      console.warn(
        `[ABUSE] Blocked slot reservation: ${abuseCheck.reason}, IP: ${clientIP}, User: ${userId?.substring(0, 8) || 'anonymous'}...`
      );
      return errorResponse(abuseCheck.reason || 'Action blocked due to abuse detection', 429);
    }

    const reserved = await slotService.reserveSlot(slotId);

    if (!reserved) {
      console.warn(
        `[SECURITY] Slot reservation failed from IP: ${clientIP}, Slot: ${slotId.substring(0, 8)}...`
      );
      return errorResponse(ERROR_MESSAGES.SLOT_NOT_AVAILABLE, 409);
    }

    console.log(`[SECURITY] Slot reserved: IP: ${clientIP}, Slot: ${slotId.substring(0, 8)}...`);
    return successResponse({ slot_id: slotId }, SUCCESS_MESSAGES.SLOT_RESERVED);
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    const statusCode =
      message.includes('not available') || message.includes('not found') ? 409 : 500;
    console.error(`[SECURITY] Slot reservation error: IP: ${clientIP}, Error: ${message}`);
    return errorResponse(message, statusCode);
  }
}
