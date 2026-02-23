import { NextRequest } from 'next/server';
import { validateCronSecret } from '@/lib/security/cron-auth';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { requireSupabaseAdmin } from '@/lib/supabase/server';
import { withCronRunLog } from '@/services/cron-run.service';

const KEEP_PER_METRIC = 2000;

export async function POST(request: NextRequest) {
  try {
    const authError = validateCronSecret(request);
    if (authError) return authError;

    return await withCronRunLog('trim-metric-timings', async () => {
      const supabase = requireSupabaseAdmin();
      const { error } = await supabase.rpc('trim_metric_timings', {
        keep_per_metric: KEEP_PER_METRIC,
      });
      if (error) throw new Error(error.message);
      return successResponse({ keep_per_metric: KEEP_PER_METRIC }, 'Metric timings trimmed');
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Trim failed';
    return errorResponse(message, 500);
  }
}
