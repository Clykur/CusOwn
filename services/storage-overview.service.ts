/**
 * Storage overview for admin: total files, size, files per bucket, upload trend.
 * Uses Supabase Storage API; no private URLs exposed.
 */

import { requireSupabaseAdmin } from '@/lib/supabase/server';
import { ADMIN_DEFAULT_ANALYTICS_DAYS } from '@/config/constants';

export interface StorageOverview {
  totalFiles: number;
  totalSizeBytes: number;
  filesPerBucket: Record<string, number>;
  filesPerBusiness: Record<string, number>;
  uploadTrend: { date: string; count: number }[];
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(str: string): boolean {
  return UUID_REGEX.test(str);
}

export class StorageOverviewService {
  async getStorageOverview(): Promise<StorageOverview> {
    const supabase = requireSupabaseAdmin();
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();

    if (bucketsError || !buckets?.length) {
      return {
        totalFiles: 0,
        totalSizeBytes: 0,
        filesPerBucket: {},
        filesPerBusiness: {},
        uploadTrend: [],
      };
    }

    let totalFiles = 0;
    let totalSizeBytes = 0;
    const filesPerBucket: Record<string, number> = {};
    const filesPerBusiness: Record<string, number> = {};
    const createdCountByDate: Record<string, number> = {};
    const trendStart = new Date();
    trendStart.setDate(trendStart.getDate() - ADMIN_DEFAULT_ANALYTICS_DAYS);

    for (const bucket of buckets) {
      const bucketName = bucket.name;
      let bucketCount = 0;
      let offset = 0;
      const limit = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data: files, error } = await supabase.storage
          .from(bucketName)
          .list('', { limit, offset });

        if (error) {
          break;
        }
        if (!files?.length) {
          hasMore = false;
          break;
        }

        for (const file of files) {
          if (file.name && !file.name.endsWith('/')) {
            bucketCount++;
            totalFiles++;
            const meta = file.metadata as Record<string, unknown> | undefined;
            const size = typeof meta?.size === 'number' ? meta.size : 0;
            totalSizeBytes += size;
            const firstSegment = file.name.split('/')[0];
            if (firstSegment && isUuid(firstSegment)) {
              filesPerBusiness[firstSegment] = (filesPerBusiness[firstSegment] ?? 0) + 1;
            }
            const created = (file as { created_at?: string }).created_at;
            if (created) {
              const date = created.split('T')[0];
              if (date >= trendStart.toISOString().split('T')[0]) {
                createdCountByDate[date] = (createdCountByDate[date] ?? 0) + 1;
              }
            }
          }
        }

        offset += files.length;
        hasMore = files.length === limit;
      }

      if (bucketCount > 0) {
        filesPerBucket[bucketName] = (filesPerBucket[bucketName] ?? 0) + bucketCount;
      }
    }

    const sortedDates = Object.keys(createdCountByDate).sort();
    const uploadTrend = sortedDates.map((date) => ({
      date,
      count: createdCountByDate[date] ?? 0,
    }));

    return {
      totalFiles,
      totalSizeBytes,
      filesPerBucket,
      filesPerBusiness,
      uploadTrend,
    };
  }
}

export const storageOverviewService = new StorageOverviewService();
