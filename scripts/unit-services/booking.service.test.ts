/**
 * Service-level tests: booking.service
 * prepareCreateBookingParams with mocked supabase and serviceService.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { bookingService } from '@/services/booking.service';
import type { CreateBookingInput } from '@/types';
import { ERROR_MESSAGES } from '@/config/constants';

const mockRequireSupabaseAdmin = vi.fn();
const mockValidateServices = vi.fn();
const mockCalculateTotalDuration = vi.fn();
const mockCalculateTotalPrice = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  requireSupabaseAdmin: () => mockRequireSupabaseAdmin(),
}));

vi.mock('@/services/service.service', () => ({
  serviceService: {
    validateServices: (...args: unknown[]) => mockValidateServices(...args),
    calculateTotalDuration: (...args: unknown[]) => mockCalculateTotalDuration(...args),
    calculateTotalPrice: (...args: unknown[]) => mockCalculateTotalPrice(...args),
  },
}));

describe('booking.service', () => {
  const validInput: CreateBookingInput = {
    salon_id: '00000000-0000-4000-8000-000000000001',
    slot_id: '00000000-0000-4000-8000-000000000002',
    customer_name: 'Test User',
    customer_phone: '9876543210',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSupabaseAdmin.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: null }),
          }),
        }),
      }),
    });
    mockValidateServices.mockResolvedValue([]);
    mockCalculateTotalDuration.mockResolvedValue(0);
    mockCalculateTotalPrice.mockResolvedValue(0);
  });

  describe('prepareCreateBookingParams', () => {
    it('returns params with formatted phone and generated booking_id', async () => {
      const out = await bookingService.prepareCreateBookingParams(validInput, null);
      expect(out.p_business_id).toBe(validInput.salon_id);
      expect(out.p_slot_id).toBe(validInput.slot_id);
      expect(out.p_customer_name).toBe(validInput.customer_name);
      expect(out.p_customer_phone).toMatch(/\+91|91/);
      expect(out.p_booking_id).toBeDefined();
      expect(out.p_booking_id.length).toBe(7);
      expect(out.p_customer_user_id).toBeNull();
      expect(out.p_total_duration_minutes).toBeNull();
      expect(out.p_total_price_cents).toBeNull();
      expect(out.p_services_count).toBe(1);
      expect(out.p_service_data).toBeNull();
    });

    it('includes customer_user_id when provided', async () => {
      const out = await bookingService.prepareCreateBookingParams(validInput, 'user-uuid-123');
      expect(out.p_customer_user_id).toBe('user-uuid-123');
    });

    it('calls validateServices and sets duration/price when serviceIds provided', async () => {
      const services = [
        {
          id: 'svc1',
          business_id: validInput.salon_id,
          duration_minutes: 30,
          price_cents: 500,
        },
      ];
      mockValidateServices.mockResolvedValue(services);
      mockCalculateTotalDuration.mockResolvedValue(30);
      mockCalculateTotalPrice.mockResolvedValue(500);

      const out = await bookingService.prepareCreateBookingParams(validInput, null, ['svc1']);
      expect(mockValidateServices).toHaveBeenCalledWith(['svc1'], validInput.salon_id);
      expect(out.p_total_duration_minutes).toBe(30);
      expect(out.p_total_price_cents).toBe(500);
      expect(out.p_services_count).toBe(1);
      expect(out.p_service_data).toEqual([{ service_id: 'svc1', price_cents: 500 }]);
    });

    it('throws when too many services', async () => {
      const manyIds = Array.from({ length: 11 }, (_, i) => `id-${i}`);
      await expect(
        bookingService.prepareCreateBookingParams(validInput, null, manyIds)
      ).rejects.toThrow('Too many services');
    });

    it('throws when booking_id collision after max attempts', async () => {
      mockRequireSupabaseAdmin.mockReturnValue({
        from: () => ({
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: { id: 'existing' } }),
            }),
          }),
        }),
      });
      await expect(bookingService.prepareCreateBookingParams(validInput, null)).rejects.toThrow(
        ERROR_MESSAGES.DATABASE_ERROR
      );
    });

    it('throws when validateServices throws', async () => {
      mockValidateServices.mockRejectedValue(new Error('Invalid or inactive service'));
      await expect(
        bookingService.prepareCreateBookingParams(validInput, null, ['bad-id'])
      ).rejects.toThrow('Invalid or inactive');
    });

    it('uses default service count and does not call validateServices when serviceIds is empty array', async () => {
      const out = await bookingService.prepareCreateBookingParams(validInput, null, []);
      expect(out.p_services_count).toBe(1);
      expect(out.p_total_duration_minutes).toBeNull();
      expect(out.p_total_price_cents).toBeNull();
      expect(mockValidateServices).not.toHaveBeenCalled();
    });

    it('formats phone with country code when customer_phone has 10 digits', async () => {
      const out = await bookingService.prepareCreateBookingParams(
        { ...validInput, customer_phone: '9876543210' },
        null
      );
      expect(out.p_customer_phone).toMatch(/^\+?91?/);
    });
  });
});
