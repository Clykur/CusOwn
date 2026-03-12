#!/usr/bin/env ts-node

import { NextRequest } from 'next/server';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function runAsyncTest(name: string, fn: () => Promise<void>): Promise<void> {
  await fn();
  console.log(`  ✅ ${name}`);
}

export async function runApiHealthRouteTests(): Promise<void> {
  console.log('\n--- API: GET /api/health ---\n');

  await runAsyncTest(
    'GET /api/health returns 200 and success response with health data',
    async () => {
      const { GET } = await import('../../app/api/health/route');
      const req = new NextRequest('http://localhost/api/health', { method: 'GET' });
      const res = await GET(req);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const body = (await res.json()) as {
        success?: boolean;
        data?: { status?: string; checks?: { database?: string; timestamp?: string } };
      };
      assert(body.success === true, 'Expected success true');
      assert(body.data != null, 'Expected data');
      assert(
        body.data?.status === 'healthy' || body.data?.status === 'unhealthy',
        'Expected status in data'
      );
      assert(body.data?.checks != null, 'Expected checks');
      assert(typeof body.data?.checks?.database === 'string', 'Expected checks.database');
      assert(typeof body.data?.checks?.timestamp === 'string', 'Expected checks.timestamp');
    }
  );
}

export async function runApiRoutingHealthRouteTests(): Promise<void> {
  console.log('\n--- API: GET /api/routing/health ---\n');

  await runAsyncTest(
    'GET /api/routing/health returns 200 and status ok with routing data',
    async () => {
      const { GET } = await import('../../app/api/routing/health/route');
      const req = new NextRequest('http://localhost/api/routing/health', { method: 'GET' });
      const res = await GET(req);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const body = (await res.json()) as { status?: string; routing?: unknown };
      assert(body.status === 'ok', `Expected status ok, got ${body.status}`);
      assert(body.routing != null, 'Expected routing');
    }
  );
}

export async function runApiOpenApiRouteTests(): Promise<void> {
  console.log('\n--- API: GET /api/openapi ---\n');

  await runAsyncTest('GET /api/openapi returns 200 and YAML content-type', async () => {
    const { GET } = await import('../../app/api/openapi/route');
    const res = await GET();
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const ct = res.headers.get('content-type') ?? '';
    assert(
      ct.includes('yaml') || ct.includes('application/yaml'),
      `Expected YAML content-type, got ${ct}`
    );
    const text = await res.text();
    assert(text.length > 0, 'Expected non-empty body');
    assert(text.includes('openapi') || text.includes('swagger'), 'Expected OpenAPI spec content');
  });
}

export async function runApiCsrfTokenRouteTests(): Promise<void> {
  console.log('\n--- API: GET /api/csrf-token ---\n');

  await runAsyncTest('GET /api/csrf-token returns 200 and success with token', async () => {
    const { GET } = await import('../../app/api/csrf-token/route');
    const req = new NextRequest('http://localhost/api/csrf-token', { method: 'GET' });
    const res = await GET(req);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const body = (await res.json()) as { success?: boolean; data?: { token?: string } };
    assert(body.success === true, 'Expected success true');
    assert(body.data != null, 'Expected data');
    assert(typeof body.data?.token === 'string', 'Expected data.token string');
    assert(body.data.token.length > 0, 'Expected non-empty token');
  });

  await runAsyncTest('GET /api/csrf-token returns same token when cookie present', async () => {
    const { GET } = await import('../../app/api/csrf-token/route');
    const token = 'existing-csrf-token-value';
    const req = new NextRequest('http://localhost/api/csrf-token', {
      method: 'GET',
      headers: { cookie: `csrf-token=${token}` },
    });
    const res = await GET(req);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const body = (await res.json()) as { success?: boolean; data?: { token?: string } };
    assert(body.success === true, 'Expected success true');
    assert(body.data?.token === token, `Expected token from cookie, got ${body.data?.token}`);
  });
}

if (require.main === module) {
  (async () => {
    await runApiHealthRouteTests();
    await runApiRoutingHealthRouteTests();
    await runApiOpenApiRouteTests();
    await runApiCsrfTokenRouteTests();
    console.log('\n✅ api-health-route (and public routes): all passed\n');
    process.exit(0);
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
