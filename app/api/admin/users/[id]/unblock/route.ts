import { NextRequest } from 'next/server';
import { adminService } from '@/services/admin.service';
import { requireAdmin } from '@/lib/utils/api-auth-pipeline';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '@/config/constants';

const ROUTE = 'POST /api/admin/users/[id]/unblock';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin(request, ROUTE);
    if (auth instanceof Response) return auth;

    const { id } = await params;
    if (!id) return errorResponse('User ID required', 400);

    await adminService.unblockUser(id);
    const user = await adminService.getAdminUserById(id);
    return successResponse(user, SUCCESS_MESSAGES.USER_UNBLOCKED);
  } catch (error) {
    if (error instanceof Error && error.message === 'User not found') {
      return errorResponse('User not found', 404);
    }
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.USER_UNBLOCK_FAILED;
    return errorResponse(message, 500);
  }
}
