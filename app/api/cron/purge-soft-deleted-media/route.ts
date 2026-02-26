/**
 * Cron: hard-delete soft-deleted media older than retention; remove from storage first.
 * Protect with CRON_SECRET.
 */

import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { validateCronSecret } from '@/lib/security/cron-auth';
import { withCronRunLog } from '@/services/cron-run.service';
import { requireSupabaseAdmin } from '@/lib/supabase/server';
import { env } from '@/config/env';
import { METRICS_MEDIA_PURGE_COUNT } from '@/config/constants';
import { metricsService } from '@/lib/monitoring/metrics';
import { supabaseStorageProvider } from '@/lib/media/storage-provider-supabase';

export async function POST(request: NextRequest) {
  try {
    const authError = validateCronSecret(request);
    if (authError) return authError;

    return await withCronRunLog('purge-soft-deleted-media', async () => {
      const supabase = requireSupabaseAdmin();
      const retentionDays = env.media.retentionDays;
      const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

      const { data: toPurge, error: selectError } = await supabase
        .from('media')
        .select('id, bucket_name, storage_path')
        .not('deleted_at', 'is', null)
        .lt('deleted_at', cutoff);

      if (selectError) throw new Error(selectError.message);

      const rows = (toPurge ?? []) as { id: string; bucket_name: string; storage_path: string }[];
      for (const row of rows) {
        try {
          await supabaseStorageProvider.remove(row.bucket_name, [row.storage_path]);
        } catch {
          // best-effort; continue to delete row
        }
      }

      const { data: deleted, error: rpcError } = await supabase.rpc('purge_soft_deleted_media', {
        p_retention_days: retentionDays,
      });
      if (rpcError) throw new Error(rpcError.message);
      const count = (deleted as number) ?? 0;
      await metricsService.increment(METRICS_MEDIA_PURGE_COUNT, count);
      return successResponse(
        { purged: count, retentionDays },
        `Purged ${count} soft-deleted media rows`
      );
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Purge failed';
    return errorResponse(message, 500);
  }
}
