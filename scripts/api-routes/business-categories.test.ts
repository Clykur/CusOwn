/**
 * API route tests: GET /api/business-categories.
 * Mocks: getBusinessCategories, next-cache.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/lib/cache/next-cache', () => ({
  setCacheHeaders: vi.fn(),
  setNoCacheHeaders: vi.fn(),
  getCachedBusiness: vi.fn().mockResolvedValue(null),
  getCachedBusinessByLink: vi.fn().mockResolvedValue(null),
}));
import { NextRequest } from 'next/server';

const mockGetBusinessCategories = vi.fn();

vi.mock('@/services/business-category.service', () => ({
  getBusinessCategories: (...args: unknown[]) => mockGetBusinessCategories(...args),
}));

describe('GET /api/business-categories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with categories on success', async () => {
    const categories = [
      { id: '1', name: 'Salon', slug: 'salon' },
      { id: '2', name: 'Spa', slug: 'spa' },
    ];
    mockGetBusinessCategories.mockResolvedValue(categories);
    const { GET } = await import('@/app/api/business-categories/route');
    const req = new NextRequest('http://localhost/api/business-categories', { method: 'GET' });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success?: boolean; data?: unknown };
    expect(body.success).toBe(true);
    expect(body.data).toEqual(categories);
  });

  it('response structure is consistent', async () => {
    mockGetBusinessCategories.mockResolvedValue([]);
    const { GET } = await import('@/app/api/business-categories/route');
    const req = new NextRequest('http://localhost/api/business-categories', { method: 'GET' });
    const res = await GET(req);
    const body = await res.json();
    expect(body).toHaveProperty('success', true);
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('returns 500 and error when downstream service throws', async () => {
    mockGetBusinessCategories.mockRejectedValue(new Error('DB connection failed'));
    const { GET } = await import('@/app/api/business-categories/route');
    const req = new NextRequest('http://localhost/api/business-categories', { method: 'GET' });
    const res = await GET(req);
    expect(res.status).toBe(500);
    const body = (await res.json()) as { success?: boolean; error?: string };
    expect(body.success).toBe(false);
    expect(body.error).toBeDefined();
    expect(body.error).toBe('DB connection failed');
  });
});
