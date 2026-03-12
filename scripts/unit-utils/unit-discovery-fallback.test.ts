/**
 * Unit tests: lib/db/discovery-fallback
 * queryDiscoveryFallback with mocked Supabase client.
 * Chain: from().select().order() then applyActiveBusinessFilters adds .eq().is(), then optional .eq(), then .range().
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { queryDiscoveryFallback } from '@/lib/db/discovery-fallback';

function makeChain(rangeResult: { data: unknown; error: unknown }) {
  const chain = {
    select: () => chain,
    order: () => chain,
    eq: () => chain,
    is: () => chain,
    range: vi.fn().mockResolvedValue(rangeResult),
  };
  return chain;
}

describe('discovery-fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('queryDiscoveryFallback', () => {
    it('returns empty array when query errors', async () => {
      const chain = makeChain({ data: null, error: { message: 'DB error' } });
      const supabase = {
        from: vi.fn().mockReturnValue(chain),
      } as unknown as Parameters<typeof queryDiscoveryFallback>[0];

      const result = await queryDiscoveryFallback(supabase, {
        p_city: null,
        p_area: null,
        p_pincode: null,
        p_category: null,
        limit: 10,
        offset: 0,
      });
      expect(result).toEqual([]);
      expect(chain.range).toHaveBeenCalledWith(0, 9);
    });

    it('maps rows to DiscoveryFallbackRow shape when query succeeds', async () => {
      const rows = [
        {
          id: 'bus-1',
          salon_name: 'Salon A',
          location: 'Mumbai',
          category: 'salon',
          latitude: 19.0,
          longitude: 72.8,
          area: 'Andheri',
          created_at: '2025-01-01T00:00:00Z',
        },
      ];
      const chain = makeChain({ data: rows, error: null });
      const supabase = {
        from: vi.fn().mockReturnValue(chain),
      } as unknown as Parameters<typeof queryDiscoveryFallback>[0];

      const result = await queryDiscoveryFallback(supabase, {
        p_city: null,
        p_area: null,
        p_pincode: null,
        p_category: null,
        limit: 10,
        offset: 0,
      });
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        business_id: 'bus-1',
        salon_name: 'Salon A',
        location: 'Mumbai',
        category: 'salon',
        latitude: 19.0,
        longitude: 72.8,
        area: 'Andheri',
        distance_km: null,
        score: 0,
        rating_avg: 0,
        booking_count_30d: 0,
        repeat_customer_ratio: 0,
        slot_availability_ratio: 0,
      });
    });

    it('returns empty array when data is null', async () => {
      const chain = makeChain({ data: null, error: null });
      const supabase = {
        from: vi.fn().mockReturnValue(chain),
      } as unknown as Parameters<typeof queryDiscoveryFallback>[0];

      const result = await queryDiscoveryFallback(supabase, {
        p_city: null,
        p_area: null,
        p_pincode: null,
        p_category: null,
        limit: 10,
        offset: 0,
      });
      expect(result).toEqual([]);
    });
  });
});
