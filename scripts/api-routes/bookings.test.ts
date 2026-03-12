/**
 * API route tests: GET /api/bookings/[id].
 * Mocks: bookingService, getAuthContext, userService, validateResourceToken, validateOwnerActionLink, enhancedRateLimit.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { ERROR_MESSAGES } from '@/config/constants';

const mockRunLazyExpireIfNeeded = vi.fn().mockResolvedValue(undefined);
const mockGetBookingByUuidWithDetails = vi.fn();
const mockGetAuthContext = vi.fn();
const mockGetUserBusinesses = vi.fn();
const mockValidateResourceToken = vi.fn();
const mockValidateOwnerActionLink = vi.fn();
const mockEnhancedRateLimit = vi.fn().mockResolvedValue(null);

vi.mock('@/services/booking.service', () => ({
  bookingService: {
    runLazyExpireIfNeeded: (...args: unknown[]) => mockRunLazyExpireIfNeeded(...args),
    getBookingByUuidWithDetails: (...args: unknown[]) => mockGetBookingByUuidWithDetails(...args),
  },
}));

vi.mock('@/lib/utils/api-auth-pipeline', () => ({
  getAuthContext: (...args: unknown[]) => mockGetAuthContext(...args),
}));

vi.mock('@/services/user.service', () => ({
  userService: {
    getUserBusinesses: (...args: unknown[]) => mockGetUserBusinesses(...args),
  },
}));

vi.mock('@/lib/utils/security', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/utils/security')>();
  return {
    ...actual,
    validateResourceToken: (...args: unknown[]) => mockValidateResourceToken(...args),
  };
});

vi.mock('@/lib/utils/secure-link-validation.server', () => ({
  validateOwnerActionLink: (...args: unknown[]) => mockValidateOwnerActionLink(...args),
}));

vi.mock('@/lib/security/rate-limit-api.security', () => ({
  enhancedRateLimit:
    () =>
    (...args: unknown[]) =>
      mockEnhancedRateLimit(...args),
}));

describe('GET /api/bookings/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRunLazyExpireIfNeeded.mockResolvedValue(undefined);
    mockEnhancedRateLimit.mockResolvedValue(null);
  });

  it('returns 404 for invalid (non-UUID) id', async () => {
    const { GET } = await import('@/app/api/bookings/[id]/route');
    const req = new NextRequest('http://localhost/api/bookings/not-a-uuid', { method: 'GET' });
    const res = await GET(req, { params: Promise.resolve({ id: 'not-a-uuid' }) });
    expect(res.status).toBe(404);
    const body = (await res.json()) as { success?: boolean; error?: string };
    expect(body.success).toBe(false);
    expect(body.error).toBe(ERROR_MESSAGES.BOOKING_NOT_FOUND);
  });

  it('returns 404 when booking not found', async () => {
    mockGetBookingByUuidWithDetails.mockResolvedValue(null);
    const { GET } = await import('@/app/api/bookings/[id]/route');
    const req = new NextRequest(
      'http://localhost/api/bookings/00000000-0000-4000-8000-000000000001',
      {
        method: 'GET',
      }
    );
    const res = await GET(req, {
      params: Promise.resolve({ id: '00000000-0000-4000-8000-000000000001' }),
    });
    expect(res.status).toBe(404);
    const body = (await res.json()) as { success?: boolean; error?: string };
    expect(body.success).toBe(false);
    expect(body.error).toBe(ERROR_MESSAGES.BOOKING_NOT_FOUND);
  });

  it('returns 401 when no auth and no token', async () => {
    const booking = {
      id: 'b1',
      booking_id: 'bid1',
      business_id: 'bus1',
      customer_user_id: null,
      status: 'pending',
    };
    mockGetBookingByUuidWithDetails.mockResolvedValue(booking);
    mockGetAuthContext.mockResolvedValue(null);
    const { GET } = await import('@/app/api/bookings/[id]/route');
    const req = new NextRequest(
      'http://localhost/api/bookings/00000000-0000-4000-8000-000000000001',
      {
        method: 'GET',
      }
    );
    const res = await GET(req, {
      params: Promise.resolve({ id: '00000000-0000-4000-8000-000000000001' }),
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { success?: boolean; error?: string };
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/auth|required/i);
  });

  it('returns 200 with booking when auth context is customer for that booking', async () => {
    const booking = {
      id: 'b1',
      booking_id: 'bid1',
      business_id: 'bus1',
      customer_user_id: 'user-1',
      status: 'pending',
    };
    mockGetBookingByUuidWithDetails.mockResolvedValue(booking);
    mockGetAuthContext.mockResolvedValue({
      user: { id: 'user-1' },
      profile: { user_type: 'customer' },
    });
    mockGetUserBusinesses.mockResolvedValue([]);
    const { GET } = await import('@/app/api/bookings/[id]/route');
    const req = new NextRequest(
      'http://localhost/api/bookings/00000000-0000-4000-8000-000000000001',
      {
        method: 'GET',
      }
    );
    const res = await GET(req, {
      params: Promise.resolve({ id: '00000000-0000-4000-8000-000000000001' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success?: boolean; data?: unknown };
    expect(body.success).toBe(true);
    expect(body.data).toEqual(booking);
  });

  it('response structure is consistent on success', async () => {
    const booking = {
      id: 'b1',
      booking_id: 'bid1',
      business_id: 'bus1',
      customer_user_id: 'user-1',
      status: 'confirmed',
    };
    mockGetBookingByUuidWithDetails.mockResolvedValue(booking);
    mockGetAuthContext.mockResolvedValue({ user: { id: 'user-1' }, profile: null });
    mockGetUserBusinesses.mockResolvedValue([]);
    const { GET } = await import('@/app/api/bookings/[id]/route');
    const req = new NextRequest(
      'http://localhost/api/bookings/00000000-0000-4000-8000-000000000001',
      {
        method: 'GET',
      }
    );
    const res = await GET(req, {
      params: Promise.resolve({ id: '00000000-0000-4000-8000-000000000001' }),
    });
    const body = await res.json();
    expect(body).toHaveProperty('success', true);
    expect(body).toHaveProperty('data');
    expect(body.data).toHaveProperty('id');
    expect(body.data).toHaveProperty('booking_id');
    expect(body.data).toHaveProperty('status');
  });
});
