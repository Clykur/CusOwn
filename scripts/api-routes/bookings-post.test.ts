/**
 * API route tests: POST /api/bookings
 * Mocks: rate limit, supabase, getServerUser, slotService, businessHoursService,
 * bookingService, abuseDetectionService, withBookingRetry, nonce-store, etc.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { ERROR_MESSAGES } from '@/config/constants';

const mockBookingRateLimitEnhanced = vi.fn().mockResolvedValue(null);
const mockRunLazyExpireIfNeeded = vi.fn().mockResolvedValue(undefined);
const mockGetSlotById = vi.fn();
const mockValidateSlot = vi.fn().mockResolvedValue({ valid: true });
const mockPrepareCreateBookingParams = vi.fn();
const mockShouldBlockAction = vi.fn().mockResolvedValue({ blocked: false });
const mockWithBookingRetry = vi.fn();
const mockCheckNonce = vi.fn().mockResolvedValue(false);
const mockStoreNonce = vi.fn().mockResolvedValue(undefined);
const mockRpc = vi.fn();

vi.mock('@/lib/security/rate-limit-api.security', () => ({
  bookingRateLimitEnhanced: (...args: unknown[]) => mockBookingRateLimitEnhanced(...args),
}));

vi.mock('@/services/booking.service', () => ({
  bookingService: {
    runLazyExpireIfNeeded: (...args: unknown[]) => mockRunLazyExpireIfNeeded(...args),
    prepareCreateBookingParams: (...args: unknown[]) => mockPrepareCreateBookingParams(...args),
  },
}));

vi.mock('@/services/slot.service', () => ({
  slotService: {
    getSlotById: (...args: unknown[]) => mockGetSlotById(...args),
  },
}));

vi.mock('@/services/business-hours.service', () => ({
  businessHoursService: {
    validateSlot: (...args: unknown[]) => mockValidateSlot(...args),
  },
}));

vi.mock('@/lib/security/abuse-detection', () => ({
  abuseDetectionService: {
    shouldBlockAction: (...args: unknown[]) => mockShouldBlockAction(...args),
  },
}));

vi.mock('@/lib/booking-retry', () => ({
  withBookingRetry: (opts: { fn: () => Promise<unknown> }) => mockWithBookingRetry(opts),
}));

vi.mock('@/lib/security/nonce-store', () => ({
  checkNonce: (...args: unknown[]) => mockCheckNonce(...args),
  storeNonce: (...args: unknown[]) => mockStoreNonce(...args),
}));

vi.mock('@/lib/supabase/server', () => ({
  requireSupabaseAdmin: () => ({
    rpc: (...args: unknown[]) => mockRpc(...args),
  }),
}));

vi.mock('@/lib/utils/validation', () => ({
  validateCreateBooking: (x: unknown) => x,
}));

vi.mock('@/lib/security/input-filter', () => ({
  filterFields: (body: unknown) => body,
  validateStringLength: () => true,
}));

vi.mock('@/lib/supabase/server-auth', () => ({
  getServerUser: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/utils/security', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/utils/security')>();
  return {
    ...actual,
    getClientIp: () => '127.0.0.1',
    isValidUUID: (s: string) => /^[0-9a-f-]{36}$/i.test(s),
  };
});

describe('POST /api/bookings', () => {
  const validBody = {
    salon_id: '00000000-0000-4000-8000-000000000001',
    slot_id: '00000000-0000-4000-8000-000000000002',
    customer_name: 'Test User',
    customer_phone: '9876543210',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockBookingRateLimitEnhanced.mockResolvedValue(null);
    mockRunLazyExpireIfNeeded.mockResolvedValue(undefined);
    mockValidateSlot.mockResolvedValue({ valid: true });
    mockShouldBlockAction.mockResolvedValue({ blocked: false });
    mockRpc.mockResolvedValueOnce({ data: null, error: null }).mockResolvedValueOnce({
      data: [{ status: 'created', booking_id: 'ABC1234' }],
      error: null,
    });
    mockGetSlotById.mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000002',
      business_id: validBody.salon_id,
      date: '2025-03-15',
      start_time: '09:00:00',
      end_time: '09:30:00',
      status: 'available',
    });
    mockPrepareCreateBookingParams.mockResolvedValue({
      p_business_id: validBody.salon_id,
      p_slot_id: validBody.slot_id,
      p_customer_name: validBody.customer_name,
      p_customer_phone: '+919876543210',
      p_booking_id: 'ABC1234',
      p_customer_user_id: null,
      p_total_duration_minutes: null,
      p_total_price_cents: null,
      p_services_count: 1,
      p_service_data: null,
    });
    mockWithBookingRetry.mockImplementation((opts: { fn: () => Promise<unknown> }) => opts.fn());
  });

  it('returns 400 when idempotency key header is missing', async () => {
    const { POST } = await import('@/app/api/bookings/route');
    const req = new NextRequest('http://localhost/api/bookings', {
      method: 'POST',
      body: JSON.stringify(validBody),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { success?: boolean; error?: string };
    expect(body.success).toBe(false);
    expect(body.error).toBe(ERROR_MESSAGES.IDEMPOTENCY_KEY_REQUIRED);
  });

  it('returns 400 when idempotency key is empty', async () => {
    const { POST } = await import('@/app/api/bookings/route');
    const req = new NextRequest('http://localhost/api/bookings', {
      method: 'POST',
      headers: { 'idempotency-key': '' },
      body: JSON.stringify(validBody),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 404 when slot not found', async () => {
    mockGetSlotById.mockResolvedValue(null);
    const { POST } = await import('@/app/api/bookings/route');
    const req = new NextRequest('http://localhost/api/bookings', {
      method: 'POST',
      headers: { 'x-idempotency-key': 'key-123' },
      body: JSON.stringify(validBody),
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
    const body = (await res.json()) as { success?: boolean; error?: string };
    expect(body.error).toBe(ERROR_MESSAGES.SLOT_NOT_FOUND);
  });

  it('returns 400 when slot does not belong to salon', async () => {
    mockGetSlotById.mockResolvedValue({
      id: validBody.slot_id,
      business_id: '00000000-0000-4000-8000-000000000099',
      date: '2025-03-15',
      start_time: '09:00:00',
      end_time: '09:30:00',
      status: 'available',
    });
    const { POST } = await import('@/app/api/bookings/route');
    const req = new NextRequest('http://localhost/api/bookings', {
      method: 'POST',
      headers: { 'x-idempotency-key': 'key-123' },
      body: JSON.stringify(validBody),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toMatch(/slot|salon/i);
  });

  it('returns 400 when business hours validation fails', async () => {
    mockValidateSlot.mockResolvedValue({ valid: false, reason: 'Outside business hours' });
    const { POST } = await import('@/app/api/bookings/route');
    const req = new NextRequest('http://localhost/api/bookings', {
      method: 'POST',
      headers: { 'x-idempotency-key': 'key-123' },
      body: JSON.stringify(validBody),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 429 when rate limit responds', async () => {
    mockBookingRateLimitEnhanced.mockResolvedValue(
      new Response(JSON.stringify({ error: 'Too many requests' }), { status: 429 })
    );
    const { POST } = await import('@/app/api/bookings/route');
    const req = new NextRequest('http://localhost/api/bookings', {
      method: 'POST',
      headers: { 'x-idempotency-key': 'key-123' },
      body: JSON.stringify(validBody),
    });
    const res = await POST(req);
    expect(res.status).toBe(429);
  });
});
