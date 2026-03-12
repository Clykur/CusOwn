/**
 * Repository tests: media.repository
 * Mocks Supabase; verifies CRUD, pagination, filtering, error propagation.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { mediaRepository, type InsertMediaRow } from '@/repositories/media.repository';

const mockFrom = vi.fn();
const mockRpc = vi.fn();
const mockRequireSupabaseAdmin = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  requireSupabaseAdmin: () => mockRequireSupabaseAdmin(),
}));

describe('media.repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSupabaseAdmin.mockReturnValue({
      from: mockFrom,
      rpc: mockRpc,
    });
  });

  describe('insert', () => {
    it('returns inserted media when insert succeeds', async () => {
      const row: InsertMediaRow = {
        entity_type: 'profile',
        entity_id: 'user-1',
        storage_path: 'profile/u1.jpg',
        bucket_name: 'uploads',
        content_type: 'image/jpeg',
        size_bytes: 1024,
      };
      const inserted = {
        id: 'mid-1',
        ...row,
        created_at: '2025-03-01T00:00:00Z',
        updated_at: '2025-03-01T00:00:00Z',
        deleted_at: null,
      };
      mockFrom.mockReturnValue({
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: inserted, error: null }),
          }),
        }),
      });
      const out = await mediaRepository.insert(row);
      expect(out).toEqual(inserted);
      expect(out.id).toBe('mid-1');
    });

    it('includes optional fields in payload when provided', async () => {
      const row: InsertMediaRow = {
        entity_type: 'business',
        entity_id: 'b1',
        storage_path: 'biz/b1.jpg',
        bucket_name: 'uploads',
        content_type: 'image/png',
        size_bytes: 2048,
        sort_order: 1,
        content_hash: 'abc',
        etag: 'xyz',
      };
      mockFrom.mockReturnValue({
        insert: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
          expect(payload.content_hash).toBe('abc');
          expect(payload.etag).toBe('xyz');
          expect(payload.sort_order).toBe(1);
          return {
            select: () => ({
              single: () =>
                Promise.resolve({
                  data: { id: 'm1', ...payload },
                  error: null,
                }),
            }),
          };
        }),
      });
      await mediaRepository.insert(row);
    });

    it('throws when insert fails', async () => {
      mockFrom.mockReturnValue({
        insert: () => ({
          select: () => ({
            single: () =>
              Promise.resolve({
                data: null,
                error: { message: 'Constraint violation' },
              }),
          }),
        }),
      });
      await expect(
        mediaRepository.insert({
          entity_type: 'profile',
          entity_id: 'u1',
          storage_path: 'p/u1.jpg',
          bucket_name: 'uploads',
          content_type: 'image/jpeg',
          size_bytes: 100,
        })
      ).rejects.toThrow('Constraint violation');
    });
  });

  describe('getById', () => {
    it('returns media when found and not deleted', async () => {
      const media = {
        id: 'mid-1',
        entity_type: 'profile',
        entity_id: 'u1',
        storage_path: 'p/u1.jpg',
        deleted_at: null,
      };
      mockFrom.mockReturnValue({
        select: () => ({
          eq: () => ({
            is: () => ({
              maybeSingle: () => Promise.resolve({ data: media, error: null }),
            }),
          }),
        }),
      });
      const out = await mediaRepository.getById('mid-1');
      expect(out).toEqual(media);
    });

    it('returns null when not found', async () => {
      mockFrom.mockReturnValue({
        select: () => ({
          eq: () => ({
            is: () => ({
              maybeSingle: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
        }),
      });
      const out = await mediaRepository.getById('nonexistent');
      expect(out).toBeNull();
    });

    it('throws when database returns error', async () => {
      mockFrom.mockReturnValue({
        select: () => ({
          eq: () => ({
            is: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: null,
                  error: { message: 'Connection failed' },
                }),
            }),
          }),
        }),
      });
      await expect(mediaRepository.getById('mid-1')).rejects.toThrow('Connection failed');
    });
  });

  describe('listByEntity', () => {
    it('returns array of media with default limit and offset', async () => {
      const list = [
        {
          id: 'm1',
          entity_type: 'business',
          entity_id: 'b1',
          sort_order: 0,
          created_at: '2025-03-01T00:00:00Z',
        },
      ];
      mockFrom.mockReturnValue({
        select: () => ({
          eq: () => ({
            eq: () => ({
              is: () => ({
                order: () => ({
                  order: () => ({
                    range: () => Promise.resolve({ data: list, error: null }),
                  }),
                }),
              }),
            }),
          }),
        }),
      });
      const out = await mediaRepository.listByEntity('business', 'b1');
      expect(out).toEqual(list);
    });

    it('applies limit and offset when provided', async () => {
      mockFrom.mockReturnValue({
        select: () => ({
          eq: () => ({
            eq: () => ({
              is: () => ({
                order: () => ({
                  order: () => ({
                    range: vi.fn().mockImplementation((offset: number, end: number) => {
                      expect(offset).toBe(10);
                      expect(end).toBe(19);
                      return Promise.resolve({ data: [], error: null });
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      });
      await mediaRepository.listByEntity('business', 'b1', {
        limit: 10,
        offset: 10,
      });
    });

    it('returns empty array when no results', async () => {
      mockFrom.mockReturnValue({
        select: () => ({
          eq: () => ({
            eq: () => ({
              is: () => ({
                order: () => ({
                  order: () => ({
                    range: () => Promise.resolve({ data: [], error: null }),
                  }),
                }),
              }),
            }),
          }),
        }),
      });
      const out = await mediaRepository.listByEntity('profile', 'u1');
      expect(out).toEqual([]);
    });
  });

  describe('countByEntity', () => {
    it('returns count when successful', async () => {
      mockFrom.mockReturnValue({
        select: () => ({
          eq: () => ({
            eq: () => ({
              is: () => Promise.resolve({ count: 5, error: null }),
            }),
          }),
        }),
      });
      const out = await mediaRepository.countByEntity('business', 'b1');
      expect(out).toBe(5);
    });

    it('returns 0 when count is null/undefined', async () => {
      mockFrom.mockReturnValue({
        select: () => ({
          eq: () => ({
            eq: () => ({
              is: () => Promise.resolve({ count: null, error: null }),
            }),
          }),
        }),
      });
      const out = await mediaRepository.countByEntity('profile', 'u1');
      expect(out).toBe(0);
    });

    it('throws when database returns error', async () => {
      mockFrom.mockReturnValue({
        select: () => ({
          eq: () => ({
            eq: () => ({
              is: () =>
                Promise.resolve({
                  count: null,
                  error: { message: 'Timeout' },
                }),
            }),
          }),
        }),
      });
      await expect(mediaRepository.countByEntity('business', 'b1')).rejects.toThrow('Timeout');
    });
  });

  describe('softDelete', () => {
    it('does not throw on success', async () => {
      mockFrom.mockReturnValue({
        update: () => ({
          eq: () => Promise.resolve({ error: null }),
        }),
      });
      await expect(mediaRepository.softDelete('mid-1')).resolves.toBeUndefined();
    });

    it('throws when update fails', async () => {
      mockFrom.mockReturnValue({
        update: () => ({
          eq: () => Promise.resolve({ error: { message: 'Row not found' } }),
        }),
      });
      await expect(mediaRepository.softDelete('mid-1')).rejects.toThrow('Row not found');
    });
  });

  describe('updateProfileMediaId', () => {
    it('does not throw on success', async () => {
      mockFrom.mockReturnValue({
        update: () => ({
          eq: () => Promise.resolve({ error: null }),
        }),
      });
      await expect(
        mediaRepository.updateProfileMediaId('user-1', 'mid-1')
      ).resolves.toBeUndefined();
    });

    it('throws when update fails', async () => {
      mockFrom.mockReturnValue({
        update: () => ({
          eq: () => Promise.resolve({ error: { message: 'FK violation' } }),
        }),
      });
      await expect(mediaRepository.updateProfileMediaId('user-1', 'bad-id')).rejects.toThrow(
        'FK violation'
      );
    });
  });

  describe('getProfileMedia', () => {
    it('returns null when profile has no profile_media_id', async () => {
      mockFrom.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve({
                data: { profile_media_id: null },
                error: null,
              }),
          }),
        }),
      });
      const out = await mediaRepository.getProfileMedia('user-1');
      expect(out).toBeNull();
    });

    it('returns media when profile has profile_media_id', async () => {
      const media = {
        id: 'mid-1',
        entity_type: 'profile',
        entity_id: 'user-1',
        storage_path: 'p/u1.jpg',
      };
      mockFrom
        .mockReturnValueOnce({
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: { profile_media_id: 'mid-1' },
                  error: null,
                }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: () => ({
            eq: () => ({
              is: () => ({
                maybeSingle: () => Promise.resolve({ data: media, error: null }),
              }),
            }),
          }),
        });
      const out = await mediaRepository.getProfileMedia('user-1');
      expect(out).toEqual(media);
    });
  });

  describe('findByContentHash', () => {
    it('returns media when found', async () => {
      const media = {
        id: 'm1',
        entity_type: 'business',
        entity_id: 'b1',
        content_hash: 'abc123',
      };
      mockFrom.mockReturnValue({
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                is: () => ({
                  maybeSingle: () => Promise.resolve({ data: media, error: null }),
                }),
              }),
            }),
          }),
        }),
      });
      const out = await mediaRepository.findByContentHash('business', 'b1', 'abc123');
      expect(out).toEqual(media);
    });

    it('returns null when not found', async () => {
      mockFrom.mockReturnValue({
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                is: () => ({
                  maybeSingle: () => Promise.resolve({ data: null, error: null }),
                }),
              }),
            }),
          }),
        }),
      });
      const out = await mediaRepository.findByContentHash('profile', 'u1', 'hash');
      expect(out).toBeNull();
    });
  });

  describe('getIdempotencyResult', () => {
    it('returns result when RPC returns data', async () => {
      const row = {
        result_id: 'mid-1',
        response_snapshot: { success: true },
      };
      mockRpc.mockResolvedValue({ data: [row], error: null });
      const out = await mediaRepository.getIdempotencyResult('key-1', 'media');
      expect(out).toEqual(row);
    });

    it('returns null when RPC returns empty or error', async () => {
      mockRpc.mockResolvedValue({ data: [], error: null });
      const out = await mediaRepository.getIdempotencyResult('key-1', 'media');
      expect(out).toBeNull();
    });
  });

  describe('callGetOrSetIdempotency', () => {
    it('returns result_id when RPC succeeds', async () => {
      mockRpc.mockResolvedValue({ data: 'existing-id', error: null });
      const out = await mediaRepository.callGetOrSetIdempotency('key-1', 'media');
      expect(out).toBe('existing-id');
    });

    it('returns null when data is null', async () => {
      mockRpc.mockResolvedValue({ data: null, error: null });
      const out = await mediaRepository.callGetOrSetIdempotency('key-1', 'media');
      expect(out).toBeNull();
    });

    it('throws when RPC fails', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'RPC failed' },
      });
      await expect(mediaRepository.callGetOrSetIdempotency('key-1', 'media')).rejects.toThrow(
        'RPC failed'
      );
    });
  });

  describe('setIdempotencyResultWithSnapshot', () => {
    it('does not throw on success', async () => {
      mockRpc.mockResolvedValue({ error: null });
      await expect(
        mediaRepository.setIdempotencyResultWithSnapshot('key-1', 'media', 'mid-1', {
          success: true,
        })
      ).resolves.toBeUndefined();
    });

    it('throws when RPC fails', async () => {
      mockRpc.mockResolvedValue({ error: { message: 'Duplicate key' } });
      await expect(
        mediaRepository.setIdempotencyResultWithSnapshot('key-1', 'media', 'mid-1', {})
      ).rejects.toThrow('Duplicate key');
    });
  });
});
