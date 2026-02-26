/**
 * Image variants pipeline: thumbnail, medium, large.
 * Queue-ready: process one or many media by id; can be driven by cron or distributed worker.
 */

import sharp from 'sharp';
import { requireSupabaseAdmin } from '@/lib/supabase/server';
import { env } from '@/config/env';
import { supabaseStorageProvider } from '@/lib/media/storage-provider-supabase';
import type { MediaVariants } from '@/types';

const bucket = (): string => env.upload.storageBucket;

export const VARIANT_SPECS = {
  thumbnail: { width: 150, height: 150, fit: 'cover' as const },
  medium: { width: 640, height: 640, fit: 'inside' as const },
  large: { width: 1280, height: 1280, fit: 'inside' as const },
};

export interface VariantResult {
  path: string;
  width: number;
  height: number;
}

/**
 * Generate variant (thumbnail/medium/large) from buffer and upload to storage.
 */
async function generateOne(
  buffer: Buffer,
  basePath: string,
  variantName: keyof typeof VARIANT_SPECS,
  contentType: string
): Promise<VariantResult> {
  const spec = VARIANT_SPECS[variantName];
  const ext = basePath.includes('.') ? basePath.slice(basePath.lastIndexOf('.')) : '.jpg';
  const path = basePath.replace(ext, `_${variantName}${ext}`);
  const out = await sharp(buffer)
    .resize(spec.width, spec.height, { fit: spec.fit })
    .toFormat(ext === '.png' ? 'png' : 'jpeg', { quality: 85 })
    .toBuffer();
  const meta = await sharp(out).metadata();
  await supabaseStorageProvider.upload(bucket(), path, out, {
    contentType: contentType.startsWith('image/png') ? 'image/png' : 'image/jpeg',
    upsert: true,
  });
  return {
    path,
    width: meta.width ?? spec.width,
    height: meta.height ?? spec.height,
  };
}

/**
 * Process one media record: fetch from storage, generate variants, update DB.
 * Idempotent for same media_id. Sets processing_status to 'completed' or 'failed'.
 */
export async function processMediaVariants(mediaId: string): Promise<{
  ok: boolean;
  variants?: MediaVariants;
  error?: string;
}> {
  const supabase = requireSupabaseAdmin();
  const { data: media, error: fetchError } = await supabase
    .from('media')
    .select('*')
    .eq('id', mediaId)
    .single();
  if (fetchError || !media) {
    return { ok: false, error: 'Media not found' };
  }
  const m = media as {
    storage_path: string;
    bucket_name: string;
    content_type: string;
    processing_status: string;
  };
  if (m.processing_status === 'completed') {
    return { ok: true, variants: (media as { variants?: MediaVariants }).variants ?? undefined };
  }
  try {
    const { data: blob } = await supabase.storage.from(m.bucket_name).download(m.storage_path);
    if (!blob) return { ok: false, error: 'Download failed' };
    const buffer = Buffer.from(await blob.arrayBuffer());
    const basePath = m.storage_path;
    const contentType = m.content_type;

    await supabase
      .from('media')
      .update({ processing_status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', mediaId);

    const [thumb, medium, large] = await Promise.all([
      generateOne(buffer, basePath, 'thumbnail', contentType),
      generateOne(buffer, basePath, 'medium', contentType),
      generateOne(buffer, basePath, 'large', contentType),
    ]);

    const variants: MediaVariants = {
      thumbnail: { path: thumb.path, width: thumb.width, height: thumb.height },
      medium: { path: medium.path, width: medium.width, height: medium.height },
      large: { path: large.path, width: large.width, height: large.height },
    };

    await supabase
      .from('media')
      .update({
        variants,
        processing_status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', mediaId);

    return { ok: true, variants };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Variant generation failed';
    await supabase
      .from('media')
      .update({
        processing_status: 'failed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', mediaId);
    return { ok: false, error: message };
  }
}
