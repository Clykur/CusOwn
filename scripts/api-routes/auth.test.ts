/**
 * API route tests: GET /api/auth/session.
 * Mocks: getServerUser, getServerUserProfile via @cusown/shared/server.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetServerUser = vi.fn();
const mockGetServerUserProfile = vi.fn();

vi.mock('@cusown/shared/server', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    getServerUser: (...args: unknown[]) => mockGetServerUser(...args),
    getServerUserProfile: (...args: unknown[]) => mockGetServerUserProfile(...args),
  };
});

describe('GET /api/auth/session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 and user null when not authenticated', async () => {
    mockGetServerUser.mockResolvedValue(null);
    const { GET } = await import('@/app/api/auth/session/route');
    const req = new NextRequest('http://localhost/api/auth/session', {
      method: 'GET',
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success?: boolean;
      data?: { user: null; profile: null };
    };
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data?.user).toBeNull();
    expect(body.data?.profile).toBeNull();
  });

  it('returns 200 and user + profile when authenticated', async () => {
    const user = { id: 'user-uuid-1', email: 'u@example.com' };
    const profile = { user_type: 'customer' };
    mockGetServerUser.mockResolvedValue(user);
    mockGetServerUserProfile.mockResolvedValue(profile);
    const { GET } = await import('@/app/api/auth/session/route');
    const req = new NextRequest('http://localhost/api/auth/session', {
      method: 'GET',
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success?: boolean;
      data?: { user: unknown; profile: unknown };
    };
    expect(body.success).toBe(true);
    expect(body.data?.user).toEqual(user);
    expect(body.data?.profile).toEqual(profile);
  });

  it('returns 200 with null session when getServerUser throws', async () => {
    mockGetServerUser.mockRejectedValue(new Error('auth failure'));
    const { GET } = await import('@/app/api/auth/session/route');
    const req = new NextRequest('http://localhost/api/auth/session', {
      method: 'GET',
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success?: boolean;
      data?: { user: null; profile: null };
    };
    expect(body.success).toBe(true);
    expect(body.data?.user).toBeNull();
    expect(body.data?.profile).toBeNull();
  });

  it('response structure has success and data', async () => {
    mockGetServerUser.mockResolvedValue(null);
    const { GET } = await import('@/app/api/auth/session/route');
    const req = new NextRequest('http://localhost/api/auth/session', {
      method: 'GET',
    });
    const res = await GET(req);
    const body = await res.json();
    expect(body).toHaveProperty('success');
    expect(body).toHaveProperty('data');
    expect(typeof body.success).toBe('boolean');
    expect(body.data).toHaveProperty('user');
    expect(body.data).toHaveProperty('profile');
  });
});
