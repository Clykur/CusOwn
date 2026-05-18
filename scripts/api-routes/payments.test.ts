/**
 * API route tests: POST /api/payments/verify.
 * Mocks handler dependencies (direct imports in payment-verify-handler.server).
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockGetServerUser,
  mockGetPaymentByPaymentId,
  mockGetBookingByUuidWithDetails,
  mockGetUserProfile,
  mockEnhancedRateLimit,
} = vi.hoisted(() => ({
  mockGetServerUser: vi.fn(),
  mockGetPaymentByPaymentId: vi.fn(),
  mockGetBookingByUuidWithDetails: vi.fn(),
  mockGetUserProfile: vi.fn(),
  mockEnhancedRateLimit: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../packages/shared/src/lib/supabase/server-auth', () => ({
  getServerUser: (...args: unknown[]) => mockGetServerUser(...args),
}));

vi.mock('../../packages/shared/src/services/payment.service', () => ({
  paymentService: {
    getPaymentByPaymentId: (...args: unknown[]) => mockGetPaymentByPaymentId(...args),
  },
}));

vi.mock('../../packages/shared/src/services/booking.service', () => ({
  bookingService: {
    getBookingByUuidWithDetails: (...args: unknown[]) => mockGetBookingByUuidWithDetails(...args),
  },
}));

vi.mock('../../packages/shared/src/services/user.service', () => ({
  userService: {
    getUserProfile: (...args: unknown[]) => mockGetUserProfile(...args),
  },
}));

vi.mock('@cusown/shared/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@cusown/shared/server')>();
  return {
    ...actual,
    enhancedRateLimit:
      () =>
      (...args: unknown[]) =>
        mockEnhancedRateLimit(...args),
  };
});

const VALID_PAYMENT_ID = '00000000-0000-4000-8000-000000000001';
const VALID_TRANSACTION_ID = 'TXN0123456789ABCDEFGH';

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
      body: JSON.stringify({
        payment_id: VALID_PAYMENT_ID,
        transaction_id: VALID_TRANSACTION_ID,
      }),
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
      body: JSON.stringify({ transaction_id: VALID_TRANSACTION_ID }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { success?: boolean; error?: string };
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/payment|required|invalid/i);
  });

  it('returns 400 when transaction_id is missing', async () => {
    mockGetServerUser.mockResolvedValue({ id: 'user-1' });
    const { POST } = await import('@/app/api/payments/verify/route');
    const req = new NextRequest('http://localhost/api/payments/verify', {
      method: 'POST',
      body: JSON.stringify({ payment_id: VALID_PAYMENT_ID }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { success?: boolean; error?: string };
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/transaction|required|invalid/i);
  });

  it('returns 404 when payment not found', async () => {
    mockGetServerUser.mockResolvedValue({ id: 'user-1' });
    mockGetPaymentByPaymentId.mockResolvedValue(null);
    const { POST } = await import('@/app/api/payments/verify/route');
    const req = new NextRequest('http://localhost/api/payments/verify', {
      method: 'POST',
      body: JSON.stringify({
        payment_id: VALID_PAYMENT_ID,
        transaction_id: VALID_TRANSACTION_ID,
      }),
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
      payment_id: VALID_PAYMENT_ID,
      booking_id: '00000000-0000-4000-8000-000000000002',
      status: 'completed',
    };
    const booking = {
      id: '00000000-0000-4000-8000-000000000002',
      customer_user_id: 'user-1',
    };
    mockGetServerUser.mockResolvedValue({ id: 'user-1' });
    mockGetPaymentByPaymentId.mockResolvedValue(payment);
    mockGetUserProfile.mockResolvedValue({ user_type: 'customer' });
    mockGetBookingByUuidWithDetails.mockResolvedValue(booking);
    const { POST } = await import('@/app/api/payments/verify/route');
    const req = new NextRequest('http://localhost/api/payments/verify', {
      method: 'POST',
      body: JSON.stringify({
        payment_id: VALID_PAYMENT_ID,
        transaction_id: VALID_TRANSACTION_ID,
      }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success?: boolean; data?: unknown };
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
  });
});
