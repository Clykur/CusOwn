/**
 * API route tests: POST /api/payments/verify.
 * Mocks: getServerUser, paymentService, bookingService, userService, enhancedRateLimit.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetServerUser = vi.fn();
const mockGetPaymentByPaymentId = vi.fn();
const mockGetBookingByUuidWithDetails = vi.fn();
const mockGetUserProfile = vi.fn();
const mockEnhancedRateLimit = vi.fn().mockResolvedValue(null);

vi.mock('@/lib/supabase/server-auth', () => ({
  getServerUser: (...args: unknown[]) => mockGetServerUser(...args),
}));

vi.mock('@/services/payment.service', () => ({
  paymentService: {
    getPaymentByPaymentId: (...args: unknown[]) => mockGetPaymentByPaymentId(...args),
  },
}));

vi.mock('@/services/booking.service', () => ({
  bookingService: {
    getBookingByUuidWithDetails: (...args: unknown[]) => mockGetBookingByUuidWithDetails(...args),
  },
}));

vi.mock('@/services/user.service', () => ({
  userService: {
    getUserProfile: (...args: unknown[]) => mockGetUserProfile(...args),
  },
}));

vi.mock('@/lib/security/rate-limit-api.security', () => ({
  enhancedRateLimit:
    () =>
    (...args: unknown[]) =>
      mockEnhancedRateLimit(...args),
}));

describe('POST /api/payments/verify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnhancedRateLimit.mockResolvedValue(null);
  });

  it('returns 401 when not authenticated', async () => {
    mockGetServerUser.mockResolvedValue(null);
    const { POST } = await import('@/app/api/payments/verify/route');
    const req = new NextRequest('http://localhost/api/payments/verify', {
      method: 'POST',
      body: JSON.stringify({ payment_id: 'p1', transaction_id: 't1' }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { success?: boolean; error?: string };
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/auth|required/i);
  });

  it('returns 400 when payment_id is missing', async () => {
    mockGetServerUser.mockResolvedValue({ id: 'user-1' });
    const { POST } = await import('@/app/api/payments/verify/route');
    const req = new NextRequest('http://localhost/api/payments/verify', {
      method: 'POST',
      body: JSON.stringify({ transaction_id: 't1' }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { success?: boolean; error?: string };
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/payment.*id|required/i);
  });

  it('returns 400 when transaction_id is missing', async () => {
    mockGetServerUser.mockResolvedValue({ id: 'user-1' });
    const { POST } = await import('@/app/api/payments/verify/route');
    const req = new NextRequest('http://localhost/api/payments/verify', {
      method: 'POST',
      body: JSON.stringify({ payment_id: 'p1' }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { success?: boolean; error?: string };
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/transaction|required/i);
  });

  it('returns 404 when payment not found', async () => {
    mockGetServerUser.mockResolvedValue({ id: 'user-1' });
    mockGetPaymentByPaymentId.mockResolvedValue(null);
    const { POST } = await import('@/app/api/payments/verify/route');
    const req = new NextRequest('http://localhost/api/payments/verify', {
      method: 'POST',
      body: JSON.stringify({ payment_id: 'p1', transaction_id: 't1' }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
    const body = (await res.json()) as { success?: boolean; error?: string };
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/not found|payment/i);
  });

  it('returns 200 with payment when customer owns booking and payment already completed', async () => {
    const payment = {
      id: 'pay-1',
      payment_id: 'p1',
      booking_id: 'b1',
      status: 'completed',
    };
    const booking = { id: 'b1', customer_user_id: 'user-1' };
    mockGetServerUser.mockResolvedValue({ id: 'user-1' });
    mockGetPaymentByPaymentId.mockResolvedValue(payment);
    mockGetUserProfile.mockResolvedValue({ user_type: 'customer' });
    mockGetBookingByUuidWithDetails.mockResolvedValue(booking);
    const { POST } = await import('@/app/api/payments/verify/route');
    const req = new NextRequest('http://localhost/api/payments/verify', {
      method: 'POST',
      body: JSON.stringify({ payment_id: 'p1', transaction_id: 't1' }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success?: boolean; data?: unknown };
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
  });
});
