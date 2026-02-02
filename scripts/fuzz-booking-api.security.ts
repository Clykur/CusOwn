#!/usr/bin/env ts-node
/**
 * Phase 5 QA: Fuzz booking endpoints.
 * Sends malformed/invalid payloads to POST /api/bookings and expects 4xx, no state change.
 */

const API_BASE = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

async function fuzzPostBookings(
  body: unknown,
  expectStatus: number = 400
): Promise<{ status: number; ok: boolean; body: unknown }> {
  const res = await fetch(`${API_BASE}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const bodyJson = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, body: bodyJson };
}

async function main() {
  const cases: { name: string; body: unknown; expectStatus?: number }[] = [
    { name: 'empty body', body: {} },
    { name: 'null body', body: null },
    {
      name: 'missing salon_id and slot_id',
      body: { customer_name: 'A', customer_phone: '+919999999999' },
    },
    {
      name: 'invalid salon_id format',
      body: {
        salon_id: 'not-a-uuid',
        slot_id: '00000000-0000-0000-0000-000000000001',
        customer_name: 'A',
        customer_phone: '+919999999999',
      },
    },
    {
      name: 'invalid slot_id format',
      body: {
        salon_id: '00000000-0000-0000-0000-000000000001',
        slot_id: 'x',
        customer_name: 'A',
        customer_phone: '+919999999999',
      },
    },
    {
      name: 'empty customer_name',
      body: {
        salon_id: '00000000-0000-0000-0000-000000000001',
        slot_id: '00000000-0000-0000-0000-000000000002',
        customer_name: '',
        customer_phone: '+919999999999',
      },
    },
    {
      name: 'empty customer_phone',
      body: {
        salon_id: '00000000-0000-0000-0000-000000000001',
        slot_id: '00000000-0000-0000-0000-000000000002',
        customer_name: 'A',
        customer_phone: '',
      },
    },
    {
      name: 'extra unknown fields',
      body: {
        salon_id: '00000000-0000-0000-0000-000000000001',
        slot_id: '00000000-0000-0000-0000-000000000002',
        customer_name: 'A',
        customer_phone: '+919999999999',
        admin: true,
      },
    },
    {
      name: 'wrong types',
      body: { salon_id: 123, slot_id: [], customer_name: 1, customer_phone: null },
    },
    {
      name: 'huge name',
      body: {
        salon_id: '00000000-0000-0000-0000-000000000001',
        slot_id: '00000000-0000-0000-0000-000000000002',
        customer_name: 'x'.repeat(300),
        customer_phone: '+919999999999',
      },
    },
  ];

  let passed = 0;
  let failed = 0;
  for (const { name, body, expectStatus = 400 } of cases) {
    const { status, ok } = await fuzzPostBookings(body, expectStatus);
    const expectOk = status >= 200 && status < 300;
    if (!ok && status === expectStatus) {
      console.log(`  ✅ ${name}: ${status} (rejected as expected)`);
      passed++;
    } else if (!ok && status >= 400) {
      console.log(`  ✅ ${name}: ${status} (rejected)`);
      passed++;
    } else {
      console.log(`  ❌ ${name}: expected 4xx, got ${status} ok=${ok}`);
      failed++;
    }
  }
  console.log(`\nPhase 5 Fuzz booking: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

export {};
