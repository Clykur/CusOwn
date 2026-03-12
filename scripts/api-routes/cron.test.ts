/**
 * API route tests: GET/POST /api/cron/health-check.
 * Verifies cron auth (401 without valid CRON_SECRET). Mocks checkHealth, withCronRunLog, and env.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const CRON_SECRET = 'test-cron-secret'; // pragma: allowlist secret

vi.mock('@/config/env', () => ({
  env: { cron: { secret: CRON_SECRET } },
}));

vi.mock('@/lib/monitoring/health', () => ({
  checkHealth: vi.fn().mockResolvedValue({
    status: 'healthy',
    checks: { database: 'up', timestamp: new Date().toISOString() },
  }),
}));

vi.mock('@/services/cron-run.service', () => ({
  withCronRunLog: vi.fn((_name: string, fn: () => Promise<unknown>) => fn()),
}));

describe('GET /api/cron/health-check', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when Authorization header is missing', async () => {
    const { GET } = await import('@/app/api/cron/health-check/route');
    const req = new NextRequest('http://localhost/api/cron/health-check', { method: 'GET' });
    const res = await GET(req);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { success?: boolean; error?: string };
    expect(body.error).toMatch(/unauthorized/i);
  });

  it('returns 401 when Bearer token does not match CRON_SECRET', async () => {
    const { GET } = await import('@/app/api/cron/health-check/route');
    const req = new NextRequest('http://localhost/api/cron/health-check', {
      method: 'GET',
      headers: { authorization: 'Bearer wrong-secret' },
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { success?: boolean; error?: string };
    expect(body.error).toMatch(/unauthorized/i);
  });

  it('returns 200 with health data when Bearer token matches CRON_SECRET', async () => {
    const { GET } = await import('@/app/api/cron/health-check/route');
    const req = new NextRequest('http://localhost/api/cron/health-check', {
      method: 'GET',
      headers: { authorization: 'Bearer test-cron-secret' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success?: boolean;
      data?: { status?: string; checks?: unknown };
    };
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data?.status).toBe('healthy');
    expect(body.data?.checks).toBeDefined();
  });

  it('response structure is consistent on success', async () => {
    const { GET } = await import('@/app/api/cron/health-check/route');
    const req = new NextRequest('http://localhost/api/cron/health-check', {
      method: 'GET',
      headers: { authorization: 'Bearer test-cron-secret' },
    });
    const res = await GET(req);
    const body = await res.json();
    expect(body).toHaveProperty('success', true);
    expect(body).toHaveProperty('data');
    expect(body.data).toHaveProperty('status');
    expect(body.data).toHaveProperty('checks');
    expect(body.data.checks).toHaveProperty('database');
    expect(body.data.checks).toHaveProperty('timestamp');
  });
});

describe('POST /api/cron/health-check', () => {
  it('returns 401 when Authorization header is missing', async () => {
    const { POST } = await import('@/app/api/cron/health-check/route');
    const req = new NextRequest('http://localhost/api/cron/health-check', { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 200 with health data when Bearer token matches', async () => {
    const { POST } = await import('@/app/api/cron/health-check/route');
    const req = new NextRequest('http://localhost/api/cron/health-check', {
      method: 'POST',
      headers: { authorization: 'Bearer test-cron-secret' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success?: boolean; data?: unknown };
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
  });
});
