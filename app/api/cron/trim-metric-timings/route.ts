import { NextRequest } from 'next/server';
import { validateCronSecret } from '@/lib/security/cron-auth';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { supabaseAdmin } from '@/lib/supabase/server';

const KEEP_PER_METRIC = 2000;

export async function POST(request: NextRequest) {
  try {
    const authError = validateCronSecret(request);
    if (authError) return authError;

    if (!supabaseAdmin) {
      return errorResponse('Database not configured', 503);
    }

    const { error } = await supabaseAdmin.rpc('trim_metric_timings', {
      keep_per_metric: KEEP_PER_METRIC,
    });

    if (error) {
      return errorResponse(error.message, 500);
    }

    return successResponse(
      { keep_per_metric: KEEP_PER_METRIC },
      'Metric timings trimmed'
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Trim failed';
    return errorResponse(message, 500);
  }
}
