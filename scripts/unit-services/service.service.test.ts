/**
 * Service-level tests: service.service
 * Pure methods: calculateTotalDuration, calculateTotalPrice. validateServices with mocked supabase.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { serviceService, type Service } from '@/services/service.service';

const mockRequireSupabaseAdmin = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  requireSupabaseAdmin: () => mockRequireSupabaseAdmin(),
}));

describe('service.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSupabaseAdmin.mockReturnValue({
      from: () => ({
        select: () => ({
          in: () => ({
            eq: () => ({
              eq: () =>
                Promise.resolve({
                  data: [
                    {
                      id: 's1',
                      business_id: 'b1',
                      name: 'Haircut',
                      duration_minutes: 30,
                      price_cents: 500,
                      is_active: true,
                    },
                    {
                      id: 's2',
                      business_id: 'b1',
                      name: 'Beard',
                      duration_minutes: 15,
                      price_cents: 200,
                      is_active: true,
                    },
                  ],
                  error: null,
                }),
            }),
          }),
        }),
      }),
    });
  });

  describe('calculateTotalDuration', () => {
    it('returns 0 for empty array', async () => {
      const out = await serviceService.calculateTotalDuration([]);
      expect(out).toBe(0);
    });

    it('sums duration_minutes of all services', async () => {
      const services: Service[] = [
        { duration_minutes: 30 } as Service,
        { duration_minutes: 45 } as Service,
        { duration_minutes: 15 } as Service,
      ];
      const out = await serviceService.calculateTotalDuration(services);
      expect(out).toBe(90);
    });

    it('is deterministic for same input', async () => {
      const services: Service[] = [{ duration_minutes: 60 } as Service];
      const a = await serviceService.calculateTotalDuration(services);
      const b = await serviceService.calculateTotalDuration(services);
      expect(a).toBe(b);
    });
  });

  describe('calculateTotalPrice', () => {
    it('returns 0 for empty array', async () => {
      const out = await serviceService.calculateTotalPrice([]);
      expect(out).toBe(0);
    });

    it('sums price_cents of all services', async () => {
      const services: Service[] = [
        { price_cents: 1000 } as Service,
        { price_cents: 500 } as Service,
      ];
      const out = await serviceService.calculateTotalPrice(services);
      expect(out).toBe(1500);
    });
  });

  describe('validateServices', () => {
    it('returns services when all ids exist and belong to business', async () => {
      const out = await serviceService.validateServices(['s1', 's2'], 'b1');
      expect(out).toHaveLength(2);
      expect(out[0].id).toBe('s1');
      expect(out[0].business_id).toBe('b1');
      expect(out[1].id).toBe('s2');
    });

    it('throws when response has error', async () => {
      mockRequireSupabaseAdmin.mockReturnValueOnce({
        from: () => ({
          select: () => ({
            in: () => ({
              eq: () => ({
                eq: () => Promise.resolve({ data: null, error: { message: 'DB error' } }),
              }),
            }),
          }),
        }),
      });
      await expect(serviceService.validateServices(['s1'], 'b1')).rejects.toThrow();
    });

    it('throws when data length does not match serviceIds length', async () => {
      mockRequireSupabaseAdmin.mockReturnValueOnce({
        from: () => ({
          select: () => ({
            in: () => ({
              eq: () => ({
                eq: () =>
                  Promise.resolve({
                    data: [{ id: 's1', business_id: 'b1' }],
                    error: null,
                  }),
              }),
            }),
          }),
        }),
      });
      await expect(serviceService.validateServices(['s1', 's2'], 'b1')).rejects.toThrow(
        /Invalid or inactive/
      );
    });
  });
});
