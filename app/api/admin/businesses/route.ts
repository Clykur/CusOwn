import { NextRequest } from 'next/server';
import { getServerUser } from '@/lib/supabase/server-auth';
import { adminService } from '@/services/admin.service';
import { checkIsAdminServer } from '@/lib/utils/admin';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { ERROR_MESSAGES } from '@/config/constants';

export async function GET(request: NextRequest) {
  try {
    const user = await getServerUser(request);
    if (!user) {
      return errorResponse('Authentication required', 401);
    }

    const isAdmin = await checkIsAdminServer(user.id);
    if (!isAdmin) {
      return errorResponse('Admin access required', 403);
    }

    const businesses = await adminService.getAllBusinesses();
    return successResponse(businesses);
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}

