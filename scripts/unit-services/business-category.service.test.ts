/**
 * Service-level tests: business-category.service
 * getBusinessCategories, getAllowedCategoryValues with mocked supabase.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  getBusinessCategories,
  getAllowedCategoryValues,
} from '@/services/business-category.service';

const mockRequireSupabaseAdmin = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  requireSupabaseAdmin: () => mockRequireSupabaseAdmin(),
}));

describe('business-category.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getBusinessCategories', () => {
    it('returns empty array when supabase returns no data', async () => {
      mockRequireSupabaseAdmin.mockReturnValue({
        from: () => ({
          select: () => ({
            eq: () => ({
              order: () => ({
                order: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          }),
        }),
      });
      const out = await getBusinessCategories();
      expect(out).toEqual([]);
    });

    it('returns categories when supabase returns data', async () => {
      const data = [
        { value: 'salon', label: 'Salon' },
        { value: 'spa', label: 'Spa' },
      ];
      mockRequireSupabaseAdmin.mockReturnValue({
        from: () => ({
          select: () => ({
            eq: () => ({
              order: () => ({
                order: () => Promise.resolve({ data, error: null }),
              }),
            }),
          }),
        }),
      });
      const out = await getBusinessCategories();
      expect(out).toEqual(data);
      expect(out).toHaveLength(2);
      expect(out[0]).toHaveProperty('value');
      expect(out[0]).toHaveProperty('label');
    });

    it('returns empty array when error', async () => {
      mockRequireSupabaseAdmin.mockReturnValue({
        from: () => ({
          select: () => ({
            eq: () => ({
              order: () => ({
                order: () => Promise.resolve({ data: null, error: { message: 'err' } }),
              }),
            }),
          }),
        }),
      });
      const out = await getBusinessCategories();
      expect(out).toEqual([]);
    });

    it('returns empty array when requireSupabaseAdmin returns null', async () => {
      mockRequireSupabaseAdmin.mockReturnValue(null);
      const out = await getBusinessCategories();
      expect(out).toEqual([]);
    });
  });

  describe('getAllowedCategoryValues', () => {
    it('returns value array from getBusinessCategories', async () => {
      mockRequireSupabaseAdmin.mockReturnValue({
        from: () => ({
          select: () => ({
            eq: () => ({
              order: () => ({
                order: () =>
                  Promise.resolve({
                    data: [
                      { value: 'salon', label: 'Salon' },
                      { value: 'spa', label: 'Spa' },
                    ],
                    error: null,
                  }),
              }),
            }),
          }),
        }),
      });
      const out = await getAllowedCategoryValues();
      expect(out).toEqual(['salon', 'spa']);
    });

    it('returns empty array when no categories', async () => {
      mockRequireSupabaseAdmin.mockReturnValue({
        from: () => ({
          select: () => ({
            eq: () => ({
              order: () => ({
                order: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          }),
        }),
      });
      const out = await getAllowedCategoryValues();
      expect(out).toEqual([]);
    });
  });
});
