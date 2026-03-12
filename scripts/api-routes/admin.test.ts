/**
 * API route tests: GET /api/admin/users.
 * Mocks: requireAdmin, adminService.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockRequireAdmin = vi.fn();
const mockGetAllUsers = vi.fn();

vi.mock('@/lib/utils/api-auth-pipeline', () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}));

vi.mock('@/services/admin.service', () => ({
  adminService: {
    getAllUsers: (...args: unknown[]) => mockGetAllUsers(...args),
  },
}));

describe('GET /api/admin/users', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when requireAdmin returns error response', async () => {
    const authError = new Response(
      JSON.stringify({ success: false, error: 'Authentication required' }),
      {
        status: 401,
      }
    );
    mockRequireAdmin.mockResolvedValue(authError);
    const { GET } = await import('@/app/api/admin/users/route');
    const req = new NextRequest('http://localhost/api/admin/users', { method: 'GET' });
    const res = await GET(req);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { success?: boolean; error?: string };
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/auth|required/i);
  });

  it('returns 200 with users when admin is authenticated', async () => {
    const users = [
      { id: 'u1', email: 'a@b.com' },
      { id: 'u2', email: 'c@d.com' },
    ];
    mockRequireAdmin.mockResolvedValue({
      user: { id: 'admin-1' },
      profile: { user_type: 'admin' },
    });
    mockGetAllUsers.mockResolvedValue(users);
    const { GET } = await import('@/app/api/admin/users/route');
    const req = new NextRequest('http://localhost/api/admin/users', { method: 'GET' });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success?: boolean; data?: unknown };
    expect(body.success).toBe(true);
    expect(body.data).toEqual(users);
  });

  it('passes limit and offset from query to getAllUsers', async () => {
    mockRequireAdmin.mockResolvedValue({ user: { id: 'admin-1' }, profile: null });
    mockGetAllUsers.mockResolvedValue([]);
    const { GET } = await import('@/app/api/admin/users/route');
    const req = new NextRequest('http://localhost/api/admin/users?limit=10&offset=20', {
      method: 'GET',
    });
    await GET(req);
    expect(mockGetAllUsers).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 10, offset: 20 })
    );
  });

  it('response structure is consistent on success', async () => {
    mockRequireAdmin.mockResolvedValue({ user: { id: 'admin-1' }, profile: null });
    mockGetAllUsers.mockResolvedValue([]);
    const { GET } = await import('@/app/api/admin/users/route');
    const req = new NextRequest('http://localhost/api/admin/users', { method: 'GET' });
    const res = await GET(req);
    const body = await res.json();
    expect(body).toHaveProperty('success', true);
    expect(body).toHaveProperty('data');
  });
});
