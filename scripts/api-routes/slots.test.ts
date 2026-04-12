/**
 * API route tests: GET /api/slots.
 * Mocks: slotService, salonService, businessHoursService, next-cache.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/lib/cache/next-cache', () => ({
  setCacheHeaders: vi.fn(),
  setNoCacheHeaders: vi.fn(),
  getCachedBusiness: vi.fn().mockResolvedValue(null),
  getCachedBusinessByLink: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/cache/api-redis-cache', () => ({
  buildApiRedisKeyFromPath: vi.fn().mockReturnValue('redis-slots-key'),
  getApiRedisCache: vi.fn().mockResolvedValue(null),
  setApiRedisCache: vi.fn().mockResolvedValue(undefined),
  API_REDIS_TTL: { SLOTS: 10 },
}));

vi.mock('@/services/service.service', () => ({
  serviceService: {
    validateServices: vi.fn(),
  },
}));
import { NextRequest } from 'next/server';
import { ERROR_MESSAGES } from '@/config/constants';

const mockGetSalonById = vi.fn();
const mockGetEffectiveHours = vi.fn();
const mockGenerateSlotsForDate = vi.fn().mockResolvedValue(undefined);
const mockGetAvailableSlots = vi.fn();

vi.mock('@/services/slot.service', () => ({
  slotService: {
    generateSlotsForDate: (...args: unknown[]) => mockGenerateSlotsForDate(...args),
    getAvailableSlots: (...args: unknown[]) => mockGetAvailableSlots(...args),
  },
}));

vi.mock('@/services/salon.service', () => ({
  salonService: {
    getSalonById: (...args: unknown[]) => mockGetSalonById(...args),
  },
}));

vi.mock('@/services/business-hours.service', () => ({
  businessHoursService: {
    getEffectiveHours: (...args: unknown[]) => mockGetEffectiveHours(...args),
  },
}));

describe('GET /api/slots', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when salon_id is missing', async () => {
    const { GET } = await import('@/app/api/slots/route');
    const req = new NextRequest('http://localhost/api/slots', { method: 'GET' });
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { success?: boolean; error?: string };
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/salon|required/i);
  });

  it('returns 400 when salon_id is not a valid UUID', async () => {
    const { GET } = await import('@/app/api/slots/route');
    const req = new NextRequest('http://localhost/api/slots?salon_id=invalid', { method: 'GET' });
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { success?: boolean; error?: string };
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/invalid|salon/i);
  });

  it('returns 400 for invalid date format', async () => {
    mockGetSalonById.mockResolvedValue({
      id: 's1',
      opening_time: '09:00',
      closing_time: '18:00',
      slot_duration: 30,
    });
    const { GET } = await import('@/app/api/slots/route');
    const req = new NextRequest(
      'http://localhost/api/slots?salon_id=00000000-0000-4000-8000-000000000001&date=bad-date',
      { method: 'GET' }
    );
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { success?: boolean; error?: string };
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/date|invalid/i);
  });

  it('returns 404 when salon not found', async () => {
    mockGetSalonById.mockResolvedValue(null);
    const { GET } = await import('@/app/api/slots/route');
    const req = new NextRequest(
      'http://localhost/api/slots?salon_id=00000000-0000-4000-8000-000000000001&date=2025-03-15',
      { method: 'GET' }
    );
    const res = await GET(req);
    expect(res.status).toBe(404);
    const body = (await res.json()) as { success?: boolean; error?: string };
    expect(body.success).toBe(false);
    expect(body.error).toBe(ERROR_MESSAGES.SALON_NOT_FOUND);
  });

  it('returns 200 with closed and slots when business is closed', async () => {
    const salonId = '00000000-0000-4000-8000-000000000001';
    mockGetSalonById.mockResolvedValue({
      id: salonId,
      opening_time: '09:00',
      closing_time: '18:00',
      slot_duration: 30,
    });
    mockGetEffectiveHours.mockResolvedValue({
      isClosed: true,
      opening_time: '09:00:00',
      closing_time: '18:00:00',
    });
    const { GET } = await import('@/app/api/slots/route');
    const req = new NextRequest(`http://localhost/api/slots?salon_id=${salonId}&date=2025-03-15`, {
      method: 'GET',
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success?: boolean;
      data?: { closed?: boolean; slots?: unknown[] };
    };
    expect(body.success).toBe(true);
    expect(body.data?.closed).toBe(true);
    expect(Array.isArray(body.data?.slots)).toBe(true);
    expect(body.data?.slots).toHaveLength(0);
  });

  it('returns 200 with slots when open and slots available', async () => {
    const salonId = '00000000-0000-4000-8000-000000000001';
    const salon = { id: salonId, opening_time: '09:00', closing_time: '18:00', slot_duration: 30 };
    mockGetSalonById.mockResolvedValue(salon);
    mockGetEffectiveHours.mockResolvedValue({
      isClosed: false,
      opening_time: '09:00:00',
      closing_time: '18:00:00',
      break_start_time: null,
      break_end_time: null,
    });
    mockGetAvailableSlots.mockResolvedValue([
      { id: 'slot1', start_time: '09:00', end_time: '09:30', status: 'available' },
    ]);
    const { GET } = await import('@/app/api/slots/route');
    const req = new NextRequest(`http://localhost/api/slots?salon_id=${salonId}&date=2025-03-15`, {
      method: 'GET',
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success?: boolean; data?: { slots?: unknown[] } };
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('slots');
    expect(Array.isArray(body.data?.slots)).toBe(true);
  });
});
