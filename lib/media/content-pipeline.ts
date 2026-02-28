/**
 * Content pipeline: EXIF strip, recompression, content-type resolution.
 * Uses sharp when available. Prevents GPS/metadata leaks and polyglot content.
 */

import sharp from 'sharp';
import { env } from '@/config/env';
import { MEDIA_ALLOWED_MIME_TYPES } from '@/config/constants';
import { resolveContentTypeFromMagicBytes } from '@/lib/validation/magic-bytes';

const ALLOWED_SET = new Set(MEDIA_ALLOWED_MIME_TYPES);

export interface ProcessedImageResult {
  buffer: Buffer;
  contentType: string;
  width?: number;
  height?: number;
}

/**
 * Strip EXIF and optionally recompress. Returns buffer and resolved content type.
 * If strip/recompress is disabled or fails, returns original buffer.
 */
export async function stripExifAndRecompress(
  input: Buffer,
  declaredContentType: string
): Promise<ProcessedImageResult> {
  const base = declaredContentType.split(';')[0].trim().toLowerCase();
  if (!ALLOWED_SET.has(base as (typeof MEDIA_ALLOWED_MIME_TYPES)[number])) {
    return { buffer: input, contentType: base };
  }
  if (!env.media.stripExif) {
    const resolved = resolveContentTypeFromMagicBytes(input) ?? base;
    return { buffer: input, contentType: resolved };
  }
  try {
    let pipeline = sharp(input);
    const meta = await pipeline.metadata();
    pipeline = pipeline.rotate();
    const format =
      base === 'image/jpeg'
        ? 'jpeg'
        : base === 'image/png'
          ? 'png'
          : base === 'image/webp'
            ? 'webp'
            : 'gif';
    const out = await pipeline
      .toFormat(format as 'jpeg' | 'png' | 'webp' | 'gif', {
        quality: 85,
        effort: 4,
      })
      .toBuffer();
    return {
      buffer: out,
      contentType: base,
      width: meta.width,
      height: meta.height,
    };
  } catch {
    const resolved = resolveContentTypeFromMagicBytes(input) ?? base;
    return { buffer: input, contentType: resolved };
  }
}

/**
 * Resolve content type from magic bytes only (no processing).
 */
export function resolveContentType(buffer: Buffer): string | null {
  return resolveContentTypeFromMagicBytes(buffer);
}
