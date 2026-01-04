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

    await slotService.releaseSlot(slotId);

    return successResponse({ slot_id: slotId }, 'Slot released successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}

