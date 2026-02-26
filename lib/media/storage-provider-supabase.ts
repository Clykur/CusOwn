/**
 * Supabase Storage implementation of StorageProvider.
 * CDN-ready: cache-control can be set via metadata; lifecycle via bucket policy.
 */

import { requireSupabaseAdmin } from '@/lib/supabase/server';
import type {
  StorageProvider,
  UploadOptions,
  SignedUrlOptions,
} from './storage-provider.interface';
import { MEDIA_CACHE_CONTROL_HEADER } from '@/config/constants';

export const supabaseStorageProvider: StorageProvider = {
  async upload(
    bucket: string,
    path: string,
    body: Buffer,
    options: UploadOptions
  ): Promise<{ etag?: string }> {
    const supabase = requireSupabaseAdmin();
    const cacheControl = options.cacheControl ?? MEDIA_CACHE_CONTROL_HEADER;
    const { data, error } = await supabase.storage.from(bucket).upload(path, body, {
      contentType: options.contentType,
      upsert: options.upsert ?? false,
      cacheControl,
      metadata: options.metadata ?? {},
    });
    if (error) throw new Error(error.message);
    return { etag: (data as { etag?: string })?.etag };
  },

  async remove(bucket: string, paths: string[]): Promise<void> {
    if (paths.length === 0) return;
    const supabase = requireSupabaseAdmin();
    const { error } = await supabase.storage.from(bucket).remove(paths);
    if (error) throw new Error(error.message);
  },

  async createSignedUrl(
    bucket: string,
    path: string,
    options: SignedUrlOptions
  ): Promise<{ url: string; expiresAt: string } | null> {
    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, options.expiresInSeconds);
    if (error || !data?.signedUrl) return null;
    const expiresAt = new Date(Date.now() + options.expiresInSeconds * 1000).toISOString();
    return { url: data.signedUrl, expiresAt };
  },
};
