/**
 * Media repository: DB access for media table only.
 * No storage or auth; used by media.service.
 */

import { requireSupabaseAdmin } from '@/lib/supabase/server';
import type { Media } from '@/types';
import type { MediaEntityType } from '@/config/constants';

export interface InsertMediaRow {
  id?: string;
  entity_type: MediaEntityType;
  entity_id: string;
  storage_path: string;
  bucket_name: string;
  content_type: string;
  size_bytes: number;
  sort_order?: number;
  content_hash?: string | null;
  etag?: string | null;
  processing_status?: string;
  variants?: Record<string, unknown> | null;
  content_type_resolved?: string | null;
  recompressed_at?: string | null;
}

export class MediaRepository {
  async insert(row: InsertMediaRow): Promise<Media> {
    const supabase = requireSupabaseAdmin();
    const payload: Record<string, unknown> = {
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      storage_path: row.storage_path,
      bucket_name: row.bucket_name,
      content_type: row.content_type,
      size_bytes: row.size_bytes,
      sort_order: row.sort_order ?? 0,
    };
    if (row.content_hash != null) payload.content_hash = row.content_hash;
    if (row.etag != null) payload.etag = row.etag;
    if (row.processing_status != null) payload.processing_status = row.processing_status;
    if (row.variants != null) payload.variants = row.variants;
    if (row.content_type_resolved != null)
      payload.content_type_resolved = row.content_type_resolved;
    if (row.recompressed_at != null) payload.recompressed_at = row.recompressed_at;
    const { data, error } = await supabase.from('media').insert(payload).select().single();
    if (error) throw new Error(error.message);
    return data as Media;
  }

  async getById(id: string): Promise<Media | null> {
    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase
      .from('media')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as Media | null;
  }

  async listByEntity(
    entityType: MediaEntityType,
    entityId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<Media[]> {
    const supabase = requireSupabaseAdmin();
    let q = supabase
      .from('media')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    const limit = options?.limit ?? 100;
    const offset = options?.offset ?? 0;
    q = q.range(offset, offset + limit - 1);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data ?? []) as Media[];
  }

  async countByEntity(entityType: MediaEntityType, entityId: string): Promise<number> {
    const supabase = requireSupabaseAdmin();
    const { count, error } = await supabase
      .from('media')
      .select('*', { count: 'exact', head: true })
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .is('deleted_at', null);
    if (error) throw new Error(error.message);
    return count ?? 0;
  }

  async softDelete(id: string): Promise<void> {
    const supabase = requireSupabaseAdmin();
    const { error } = await supabase
      .from('media')
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (error) throw new Error(error.message);
  }

  async updateProfileMediaId(userId: string, mediaId: string | null): Promise<void> {
    const supabase = requireSupabaseAdmin();
    const { error } = await supabase
      .from('user_profiles')
      .update({
        profile_media_id: mediaId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);
    if (error) throw new Error(error.message);
  }

  async getProfileMedia(userId: string): Promise<Media | null> {
    const supabase = requireSupabaseAdmin();
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('profile_media_id')
      .eq('id', userId)
      .maybeSingle();
    if (!profile?.profile_media_id) return null;
    return this.getById(profile.profile_media_id);
  }

  async findByContentHash(
    entityType: MediaEntityType,
    entityId: string,
    contentHash: string
  ): Promise<Media | null> {
    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase
      .from('media')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .eq('content_hash', contentHash)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as Media | null;
  }

  async getIdempotencyResult(
    key: string,
    resourceType: string
  ): Promise<{ result_id: string | null; response_snapshot: unknown } | null> {
    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase.rpc('get_idempotency_result_generic', {
      p_key: key,
      p_resource_type: resourceType,
    });
    if (error || !data?.length) return null;
    const row = data[0] as {
      result_id: string | null;
      response_snapshot: unknown;
    };
    return row;
  }

  /** Returns existing result_id if key was already used; NULL if key reserved for this request. */
  async callGetOrSetIdempotency(key: string, resourceType: string): Promise<string | null> {
    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase.rpc('get_or_set_idempotency', {
      p_key: key,
      p_resource_type: resourceType,
      p_ttl_hours: 24,
    });
    if (error) throw new Error(error.message);
    return data ?? null;
  }

  async setIdempotencyResultWithSnapshot(
    key: string,
    resourceType: string,
    resultId: string,
    responseSnapshot: Record<string, unknown>
  ): Promise<void> {
    const supabase = requireSupabaseAdmin();
    const { error } = await supabase.rpc('set_idempotency_result_with_snapshot', {
      p_key: key,
      p_resource_type: resourceType,
      p_result_id: resultId,
      p_response_snapshot: responseSnapshot,
    });
    if (error) throw new Error(error.message);
  }
}

export const mediaRepository = new MediaRepository();
