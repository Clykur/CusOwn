/**
 * Upload validation: file type, size, filename sanitization, path traversal prevention.
 * No business logic; use constants from config.
 */

import {
  MEDIA_ALLOWED_MIME_TYPES,
  MEDIA_MAX_FILE_SIZE_BYTES,
  ERROR_MESSAGES,
} from '@/config/constants';

const ALLOWED_SET = new Set<string>(MEDIA_ALLOWED_MIME_TYPES);

/** Dangerous patterns in filenames (path traversal, control chars). */
const UNSAFE_FILENAME_REGEX = /[<>:"/\\|?*\x00-\x1f]/g;
const MAX_FILENAME_LENGTH = 200;
const SAFE_EXT_REGEX = /^\.(jpe?g|png|gif|webp)$/i;

export interface UploadValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate content-type is an allowed image type.
 */
export function validateContentType(contentType: string | null): UploadValidationResult {
  if (!contentType || typeof contentType !== 'string') {
    return { valid: false, error: ERROR_MESSAGES.MEDIA_FILE_TYPE_INVALID };
  }
  const base = contentType.split(';')[0].trim().toLowerCase();
  if (!ALLOWED_SET.has(base)) {
    return { valid: false, error: ERROR_MESSAGES.MEDIA_FILE_TYPE_INVALID };
  }
  return { valid: true };
}

/**
 * Validate file size.
 */
export function validateFileSize(sizeBytes: number): UploadValidationResult {
  if (typeof sizeBytes !== 'number' || sizeBytes <= 0 || sizeBytes > MEDIA_MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: ERROR_MESSAGES.MEDIA_FILE_TOO_LARGE };
  }
  return { valid: true };
}

/**
 * Sanitize filename: remove path traversal and unsafe chars; limit length.
 * Returns a safe basename (no path segments).
 */
export function sanitizeFilename(filename: string): string {
  if (typeof filename !== 'string') return 'image';
  let base = filename.replace(UNSAFE_FILENAME_REGEX, '').trim();
  const lastSlash = base.lastIndexOf('/');
  if (lastSlash !== -1) base = base.slice(lastSlash + 1);
  const lastBack = base.lastIndexOf('\\');
  if (lastBack !== -1) base = base.slice(lastBack + 1);
  if (base.length > MAX_FILENAME_LENGTH) {
    const ext = base.includes('.') ? base.slice(base.lastIndexOf('.')) : '';
    base = base.slice(0, MAX_FILENAME_LENGTH - ext.length) + ext;
  }
  return base || 'image';
}

/**
 * Ensure extension is one of allowed image extensions (for storage path).
 */
export function ensureSafeExtension(filename: string): string {
  const ext = filename.includes('.') ? filename.slice(filename.lastIndexOf('.')).toLowerCase() : '';
  if (SAFE_EXT_REGEX.test(ext)) return ext;
  return '.jpg';
}

/**
 * Build storage path segment: no leading/trailing slashes, no '..'.
 */
export function buildStoragePath(prefix: string, id: string, safeFilename: string): string {
  const segs = [prefix, id, safeFilename].filter(Boolean);
  const path = segs.join('/').replace(/\/+/g, '/');
  if (path.includes('..')) {
    return segs
      .map((s) => s.replace(/\.\./g, ''))
      .join('/')
      .replace(/\/+/g, '/');
  }
  return path;
}
