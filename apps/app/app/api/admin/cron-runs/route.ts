import { NextRequest } from 'next/server';
import {
  cronRunService,
  type CronRunStatus,
  requireAdmin,
  successResponse,
  errorResponse,
  parseLimitOffset,
} from '@cusown/shared/server';
import { ERROR_MESSAGES, API_PAGINATION_MAX_LIMIT } from '@cusown/config';

const ROUTE = 'GET /api/admin/cron-runs';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request, ROUTE);
    if (auth instanceof Response) return auth;

    const searchParams = request.nextUrl.searchParams;
    const { limit, offset } = parseLimitOffset(searchParams, 25, API_PAGINATION_MAX_LIMIT);
    const job_name = searchParams.get('job_name') ?? undefined;
    const status = searchParams.get('status') as CronRunStatus | undefined;
    const start_date = searchParams.get('start_date') ?? undefined;
    const end_date = searchParams.get('end_date') ?? undefined;

    const result = await cronRunService.getCronRuns({
      job_name,
      status,
      start_date,
      end_date,
      limit,
      offset,
    });

    return successResponse(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}
