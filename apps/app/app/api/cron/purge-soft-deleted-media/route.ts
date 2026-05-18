/**
 * Cron: hard-delete soft-deleted media older than retention; remove from storage first.
 * Protect with CRON_SECRET.
 */

import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@cusown/shared/server';
import { validateCronSecret } from '@cusown/shared/server';
import { withCronRunLog } from '@cusown/shared/server';
import { requireSupabaseAdmin } from '@cusown/shared/server';
import { env } from '@cusown/config';
import { METRICS_MEDIA_PURGE_COUNT } from '@cusown/config';
import { safeMetrics } from '@cusown/shared/server';
import { supabaseStorageProvider } from '@cusown/shared/server';

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

      const rows = (toPurge ?? []) as {
        id: string;
        bucket_name: string;
        storage_path: string;
      }[];
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
      safeMetrics.increment(METRICS_MEDIA_PURGE_COUNT, count);
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
