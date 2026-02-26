/**
 * Magic-byte (file signature) validation to verify real image type.
 * Prevents polyglot attacks and MIME mismatch (declared type vs actual content).
 * Allowed types: JPEG, PNG, GIF, WebP.
 */

import { MEDIA_ALLOWED_MIME_TYPES } from '@/config/constants';
import { ERROR_MESSAGES } from '@/config/constants';

const SIGNATURES: Array<{ mime: string; check: (buf: Buffer) => boolean }> = [
  {
    mime: 'image/jpeg',
    check: (buf) => buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff,
  },
  {
    mime: 'image/png',
    check: (buf) =>
      buf.length >= 8 &&
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47 &&
      buf[4] === 0x0d &&
      buf[5] === 0x0a &&
      buf[6] === 0x1a &&
      buf[7] === 0x0a,
  },
  {
    mime: 'image/gif',
    check: (buf) =>
      buf.length >= 6 &&
      buf[0] === 0x47 &&
      buf[1] === 0x49 &&
      buf[2] === 0x46 &&
      buf[3] === 0x38 &&
      (buf[4] === 0x37 || buf[4] === 0x39) &&
      buf[5] === 0x61,
  },
  {
    mime: 'image/webp',
    check: (buf) =>
      buf.length >= 12 &&
      buf[0] === 0x52 &&
      buf[1] === 0x49 &&
      buf[2] === 0x46 &&
      buf[3] === 0x46 &&
      buf[8] === 0x57 &&
      buf[9] === 0x45 &&
      buf[10] === 0x42 &&
      buf[11] === 0x50,
  },
];

const MIME_SET = new Set(MEDIA_ALLOWED_MIME_TYPES);

export interface MagicByteResult {
  valid: boolean;
  resolvedMime?: string;
  error?: string;
}

/**
 * Resolve actual content type from file signature. Returns first matching allowed type.
 */
export function resolveContentTypeFromMagicBytes(buffer: Buffer): string | null {
  if (!buffer || buffer.length < 12) return null;
  for (const { mime, check } of SIGNATURES) {
    if (MIME_SET.has(mime as (typeof MEDIA_ALLOWED_MIME_TYPES)[number]) && check(buffer)) {
      return mime;
    }
  }
  return null;
}

/**
 * Verify declared MIME matches actual file signature. Rejects polyglot and mismatch.
 */
export function validateMagicBytes(buffer: Buffer, declaredContentType: string): MagicByteResult {
  const base = declaredContentType.split(';')[0].trim().toLowerCase();
  if (!MIME_SET.has(base as (typeof MEDIA_ALLOWED_MIME_TYPES)[number])) {
    return { valid: false, error: ERROR_MESSAGES.MEDIA_FILE_TYPE_INVALID };
  }
  const resolved = resolveContentTypeFromMagicBytes(buffer);
  if (!resolved) {
    return { valid: false, error: ERROR_MESSAGES.MEDIA_FILE_TYPE_INVALID };
  }
  if (resolved !== base) {
    return {
      valid: false,
      resolvedMime: resolved,
      error: ERROR_MESSAGES.MEDIA_FILE_TYPE_INVALID,
    };
  }
  return { valid: true, resolvedMime: resolved };
}
