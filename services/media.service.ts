/**
 * Media service: upload (atomic, idempotent), signed URLs, delete.
 * Hardening: magic-byte validation, EXIF strip, content hash, duplicate reject,
 * circuit breaker, security log, metrics, storage provider abstraction.
 */

import { createHash, randomUUID } from 'crypto';
import { env } from '@/config/env';
import {
  MEDIA_MAX_BUSINESS_IMAGES,
  MEDIA_IDEMPOTENCY_RESOURCE_PROFILE,
  MEDIA_IDEMPOTENCY_RESOURCE_BUSINESS,
  MEDIA_SECURITY_EVENTS,
  METRICS_MEDIA_UPLOAD_SUCCESS,
  METRICS_MEDIA_UPLOAD_FAILURE,
  METRICS_MEDIA_UPLOAD_DURATION_MS,
  METRICS_MEDIA_SIGNED_URL_GENERATED,
  METRICS_MEDIA_SIGNED_URL_DURATION_MS,
  ERROR_MESSAGES,
} from '@/config/constants';
import {
  validateContentType,
  validateFileSize,
  sanitizeFilename,
  ensureSafeExtension,
  buildStoragePath,
} from '@/lib/validation/upload-validation';
import { validateMagicBytes } from '@/lib/validation/magic-bytes';
import { stripExifAndRecompress } from '@/lib/media/content-pipeline';
import { mediaRepository } from '@/repositories/media.repository';
import { auditService } from '@/services/audit.service';
import { supabaseStorageProvider } from '@/lib/media/storage-provider-supabase';
import { logMediaSecurityEvent } from '@/lib/media/media-security-log';
import {
  isCircuitOpen,
  recordUploadFailure,
  recordUploadSuccess,
} from '@/lib/media/circuit-breaker';
import { metricsService } from '@/lib/monitoring/metrics';
import type { Media, MediaListItem } from '@/types';
import type { NextRequest } from 'next/server';
import { MEDIA_CACHE_CONTROL_HEADER } from '@/config/constants';

const bucket = (): string => env.upload.storageBucket;

function toListItem(m: Media): MediaListItem {
  return {
    id: m.id,
    entity_type: m.entity_type,
    entity_id: m.entity_id,
    content_type: m.content_type,
    size_bytes: m.size_bytes,
    sort_order: m.sort_order,
    created_at: m.created_at,
    etag: m.etag ?? undefined,
    variants: m.variants ?? undefined,
  };
}

export interface UploadProfileImageInput {
  userId: string;
  file: Buffer;
  contentType: string;
  sizeBytes: number;
  originalFilename?: string;
  idempotencyKey?: string | null;
  request?: NextRequest;
}

export interface UploadBusinessImageInput {
  businessId: string;
  file: Buffer;
  contentType: string;
  sizeBytes: number;
  originalFilename?: string;
  sortOrder?: number;
  actorId?: string | null;
  idempotencyKey?: string | null;
  request?: NextRequest;
}

function computeContentHash(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export class MediaService {
  validateUpload(contentType: string, sizeBytes: number): { ok: boolean; error?: string } {
    const typeResult = validateContentType(contentType);
    if (!typeResult.valid) return { ok: false, error: typeResult.error };
    const sizeResult = validateFileSize(sizeBytes);
    if (!sizeResult.valid) return { ok: false, error: sizeResult.error };
    return { ok: true };
  }

  /**
   * Upload profile image. Atomic: storage then DB; rollback storage on DB fail.
   * Idempotent when idempotencyKey provided. Circuit breaker and security log applied.
   */
  async uploadProfileImage(input: UploadProfileImageInput): Promise<MediaListItem> {
    const startMs = Date.now();
    const circuitKey = `profile:${input.userId}`;
    if (isCircuitOpen(circuitKey)) {
      await logMediaSecurityEvent({
        eventType: MEDIA_SECURITY_EVENTS.CIRCUIT_OPEN,
        userId: input.userId,
        entityType: 'profile',
        entityId: input.userId,
        request: input.request,
      });
      throw new Error(ERROR_MESSAGES.RATE_LIMIT_EXCEEDED);
    }

    if (input.idempotencyKey) {
      const existing = await mediaRepository.getIdempotencyResult(
        input.idempotencyKey,
        MEDIA_IDEMPOTENCY_RESOURCE_PROFILE
      );
      const snapshot = existing?.response_snapshot as
        | { _in_progress?: string; media?: MediaListItem }
        | undefined;
      if (snapshot?.media && snapshot._in_progress !== 'true') {
        return snapshot.media;
      }
      const existingResultId = await mediaRepository.callGetOrSetIdempotency(
        input.idempotencyKey,
        MEDIA_IDEMPOTENCY_RESOURCE_PROFILE
      );
      if (existingResultId) {
        const again = await mediaRepository.getIdempotencyResult(
          input.idempotencyKey,
          MEDIA_IDEMPOTENCY_RESOURCE_PROFILE
        );
        const snap = again?.response_snapshot as { media?: MediaListItem } | undefined;
        if (snap?.media) return snap.media;
      }
    }

    let file = input.file;
    let contentType = input.contentType.split(';')[0].trim().toLowerCase();
    const sizeBytes = input.sizeBytes;

    const valid = this.validateUpload(contentType, sizeBytes);
    if (!valid.ok) {
      await logMediaSecurityEvent({
        eventType: MEDIA_SECURITY_EVENTS.UPLOAD_FAILED,
        userId: input.userId,
        details: { reason: valid.error },
        request: input.request,
      });
      recordUploadFailure(circuitKey);
      throw new Error(valid.error);
    }

    if (env.media.validateMagicBytes) {
      const magic = validateMagicBytes(file, contentType);
      if (!magic.valid) {
        await logMediaSecurityEvent({
          eventType: MEDIA_SECURITY_EVENTS.MAGIC_BYTE_REJECT,
          userId: input.userId,
          details: { resolvedMime: magic.resolvedMime },
          request: input.request,
        });
        recordUploadFailure(circuitKey);
        throw new Error(ERROR_MESSAGES.MEDIA_FILE_TYPE_INVALID);
      }
      if (magic.resolvedMime) contentType = magic.resolvedMime;
    }

    if (env.media.stripExif) {
      const processed = await stripExifAndRecompress(file, contentType);
      file = processed.buffer;
      contentType = processed.contentType;
    }

    const contentHash = computeContentHash(file);
    const existingByHash = await mediaRepository.findByContentHash(
      'profile',
      input.userId,
      contentHash
    );
    if (existingByHash) {
      await logMediaSecurityEvent({
        eventType: MEDIA_SECURITY_EVENTS.DUPLICATE_REJECT,
        userId: input.userId,
        entityType: 'profile',
        entityId: input.userId,
        details: { content_hash: contentHash },
        request: input.request,
      });
      return toListItem(existingByHash);
    }

    const ext = ensureSafeExtension(sanitizeFilename(input.originalFilename ?? 'image'));
    const mediaId = randomUUID();
    const storagePath = buildStoragePath('profile', input.userId, `${mediaId}${ext}`);

    try {
      const { etag } = await supabaseStorageProvider.upload(bucket(), storagePath, file, {
        contentType,
        cacheControl: MEDIA_CACHE_CONTROL_HEADER,
        upsert: true,
      });

      const existingProfile = await mediaRepository.getProfileMedia(input.userId);
      if (existingProfile) {
        await mediaRepository.softDelete(existingProfile.id);
        await supabaseStorageProvider.remove(bucket(), [existingProfile.storage_path]);
      }
      const media = await mediaRepository.insert({
        entity_type: 'profile',
        entity_id: input.userId,
        storage_path: storagePath,
        bucket_name: bucket(),
        content_type: contentType,
        size_bytes: file.length,
        sort_order: 0,
        content_hash: contentHash,
        etag: etag ?? null,
        processing_status: 'completed',
        content_type_resolved: contentType,
        recompressed_at: env.media.stripExif ? new Date().toISOString() : null,
      });
      await mediaRepository.updateProfileMediaId(input.userId, media.id);
      await auditService.createAuditLog(input.userId, 'media_uploaded', 'media', {
        entityId: media.id,
        description: 'Profile image uploaded',
      });
      recordUploadSuccess(circuitKey);
      await metricsService.increment(METRICS_MEDIA_UPLOAD_SUCCESS);
      await metricsService.recordTiming(METRICS_MEDIA_UPLOAD_DURATION_MS, Date.now() - startMs);

      const item = toListItem(media);
      if (input.idempotencyKey) {
        await mediaRepository.setIdempotencyResultWithSnapshot(
          input.idempotencyKey,
          MEDIA_IDEMPOTENCY_RESOURCE_PROFILE,
          media.id,
          { media: item }
        );
      }
      return item;
    } catch (err) {
      recordUploadFailure(circuitKey);
      await metricsService.increment(METRICS_MEDIA_UPLOAD_FAILURE);
      await logMediaSecurityEvent({
        eventType: MEDIA_SECURITY_EVENTS.UPLOAD_FAILED,
        userId: input.userId,
        details: { error: err instanceof Error ? err.message : 'unknown' },
        request: input.request,
      });
      try {
        await supabaseStorageProvider.remove(bucket(), [storagePath]);
      } catch {
        // best-effort cleanup
      }
      throw err;
    }
  }

  /**
   * Upload business image. Atomic, idempotent, duplicate-by-hash rejected, circuit breaker.
   */
  async uploadBusinessImage(input: UploadBusinessImageInput): Promise<MediaListItem> {
    const startMs = Date.now();
    const actorId = input.actorId ?? null;
    const circuitKey = `business:${actorId ?? 'anon'}`;
    if (isCircuitOpen(circuitKey)) {
      await logMediaSecurityEvent({
        eventType: MEDIA_SECURITY_EVENTS.CIRCUIT_OPEN,
        userId: actorId ?? undefined,
        entityType: 'business',
        entityId: input.businessId,
        request: input.request,
      });
      throw new Error(ERROR_MESSAGES.RATE_LIMIT_EXCEEDED);
    }

    if (input.idempotencyKey) {
      const existing = await mediaRepository.getIdempotencyResult(
        input.idempotencyKey,
        MEDIA_IDEMPOTENCY_RESOURCE_BUSINESS
      );
      const snapshot = existing?.response_snapshot as
        | { _in_progress?: string; media?: MediaListItem }
        | undefined;
      if (snapshot?.media && snapshot._in_progress !== 'true') {
        return snapshot.media;
      }
      const existingResultId = await mediaRepository.callGetOrSetIdempotency(
        input.idempotencyKey,
        MEDIA_IDEMPOTENCY_RESOURCE_BUSINESS
      );
      if (existingResultId) {
        const again = await mediaRepository.getIdempotencyResult(
          input.idempotencyKey,
          MEDIA_IDEMPOTENCY_RESOURCE_BUSINESS
        );
        const snap = again?.response_snapshot as { media?: MediaListItem } | undefined;
        if (snap?.media) return snap.media;
      }
    }

    let file = input.file;
    let contentType = input.contentType.split(';')[0].trim().toLowerCase();
    const valid = this.validateUpload(contentType, input.sizeBytes);
    if (!valid.ok) {
      recordUploadFailure(circuitKey);
      throw new Error(valid.error);
    }
    if (env.media.validateMagicBytes) {
      const magic = validateMagicBytes(file, contentType);
      if (!magic.valid) {
        await logMediaSecurityEvent({
          eventType: MEDIA_SECURITY_EVENTS.MAGIC_BYTE_REJECT,
          userId: actorId ?? undefined,
          entityType: 'business',
          entityId: input.businessId,
          request: input.request,
        });
        recordUploadFailure(circuitKey);
        throw new Error(ERROR_MESSAGES.MEDIA_FILE_TYPE_INVALID);
      }
      if (magic.resolvedMime) contentType = magic.resolvedMime;
    }
    if (env.media.stripExif) {
      const processed = await stripExifAndRecompress(file, contentType);
      file = processed.buffer;
      contentType = processed.contentType;
    }

    const contentHash = computeContentHash(file);
    const existingByHash = await mediaRepository.findByContentHash(
      'business',
      input.businessId,
      contentHash
    );
    if (existingByHash) {
      await logMediaSecurityEvent({
        eventType: MEDIA_SECURITY_EVENTS.DUPLICATE_REJECT,
        userId: actorId ?? undefined,
        entityType: 'business',
        entityId: input.businessId,
        details: { content_hash: contentHash },
        request: input.request,
      });
      return toListItem(existingByHash);
    }

    const count = await mediaRepository.countByEntity('business', input.businessId);
    if (count >= MEDIA_MAX_BUSINESS_IMAGES) {
      throw new Error(ERROR_MESSAGES.MEDIA_BUSINESS_MAX_IMAGES);
    }

    const ext = ensureSafeExtension(sanitizeFilename(input.originalFilename ?? 'image'));
    const mediaId = randomUUID();
    const storagePath = buildStoragePath('business', input.businessId, `${mediaId}${ext}`);

    try {
      const { etag } = await supabaseStorageProvider.upload(bucket(), storagePath, file, {
        contentType,
        cacheControl: MEDIA_CACHE_CONTROL_HEADER,
        upsert: false,
      });

      const media = await mediaRepository.insert({
        entity_type: 'business',
        entity_id: input.businessId,
        storage_path: storagePath,
        bucket_name: bucket(),
        content_type: contentType,
        size_bytes: file.length,
        sort_order: input.sortOrder ?? count,
        content_hash: contentHash,
        etag: etag ?? null,
        processing_status: 'completed',
        content_type_resolved: contentType,
        recompressed_at: env.media.stripExif ? new Date().toISOString() : null,
      });
      await auditService.createAuditLog(actorId ?? null, 'media_uploaded', 'media', {
        entityId: media.id,
        newData: { entity_type: 'business', entity_id: input.businessId },
        description: 'Business image uploaded',
      });
      recordUploadSuccess(circuitKey);
      await metricsService.increment(METRICS_MEDIA_UPLOAD_SUCCESS);
      await metricsService.recordTiming(METRICS_MEDIA_UPLOAD_DURATION_MS, Date.now() - startMs);

      const item = toListItem(media);
      if (input.idempotencyKey) {
        await mediaRepository.setIdempotencyResultWithSnapshot(
          input.idempotencyKey,
          MEDIA_IDEMPOTENCY_RESOURCE_BUSINESS,
          media.id,
          { media: item }
        );
      }
      return item;
    } catch (err) {
      recordUploadFailure(circuitKey);
      await metricsService.increment(METRICS_MEDIA_UPLOAD_FAILURE);
      try {
        await supabaseStorageProvider.remove(bucket(), [storagePath]);
      } catch {
        // best-effort cleanup
      }
      throw err;
    }
  }

  async listBusinessMedia(
    businessId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<MediaListItem[]> {
    const list = await mediaRepository.listByEntity('business', businessId, options);
    return list.map(toListItem);
  }

  async getMediaById(id: string): Promise<Media | null> {
    return mediaRepository.getById(id);
  }

  async createSignedUrl(
    mediaId: string,
    expiresInSeconds?: number
  ): Promise<{ url: string; expiresAt: string } | null> {
    const startMs = Date.now();
    const media = await mediaRepository.getById(mediaId);
    if (!media) return null;
    const ttl = expiresInSeconds ?? env.security.signedUrlTtlSeconds;
    const result = await supabaseStorageProvider.createSignedUrl(
      media.bucket_name,
      media.storage_path,
      { expiresInSeconds: ttl }
    );
    if (result) {
      await metricsService.increment(METRICS_MEDIA_SIGNED_URL_GENERATED);
      await metricsService.recordTiming(METRICS_MEDIA_SIGNED_URL_DURATION_MS, Date.now() - startMs);
    }
    return result;
  }

  async deleteMedia(mediaId: string, actorId: string): Promise<void> {
    const media = await mediaRepository.getById(mediaId);
    if (!media) throw new Error(ERROR_MESSAGES.MEDIA_NOT_FOUND);
    await mediaRepository.softDelete(mediaId);
    await supabaseStorageProvider.remove(media.bucket_name, [media.storage_path]);
    if (media.entity_type === 'profile') {
      await mediaRepository.updateProfileMediaId(media.entity_id, null);
    }
    await auditService.createAuditLog(actorId, 'media_deleted', 'media', {
      entityId: mediaId,
      description: `${media.entity_type} media deleted`,
    });
  }

  async getProfileMedia(userId: string): Promise<Media | null> {
    return mediaRepository.getProfileMedia(userId);
  }
}

export const mediaService = new MediaService();
