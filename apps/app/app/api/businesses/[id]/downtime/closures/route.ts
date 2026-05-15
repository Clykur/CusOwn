import { NextRequest } from "next/server";
import {
  downtimeService,
  successResponse,
  errorResponse,
  isValidUUID,
  getUserFriendlyError,
} from "@cusown/shared/server";
import { ERROR_MESSAGES } from "@cusown/config";

/**
 * Public/Customer or Owner-scoped GET for business closures.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    if (!isValidUUID(id)) {
      return errorResponse(ERROR_MESSAGES.INVALID_INPUT, 400);
    }

    const closures = await downtimeService.getBusinessClosures(id);
    return successResponse(closures);
  } catch (err) {
    const friendlyMessage = getUserFriendlyError(err);
    return errorResponse(friendlyMessage, 500);
  }
}
