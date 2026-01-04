import { NextRequest } from 'next/server';
import { slotService } from '@/services/slot.service';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '@/config/constants';
import { isValidUUID } from '@/lib/utils/security';

export async function POST(
  request: NextRequest,
  { params }: { params: { slotId: string } }
) {
  try {
    const slotId = params.slotId;

    if (!isValidUUID(slotId)) {
      return errorResponse('Invalid slot ID', 400);
    }

    const reserved = await slotService.reserveSlot(slotId);

    if (!reserved) {
      return errorResponse(ERROR_MESSAGES.SLOT_NOT_AVAILABLE, 409);
    }

    return successResponse({ slot_id: slotId }, SUCCESS_MESSAGES.SLOT_RESERVED);
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    const statusCode = message.includes('not available') || message.includes('not found') ? 409 : 500;
    return errorResponse(message, statusCode);
  }
}

