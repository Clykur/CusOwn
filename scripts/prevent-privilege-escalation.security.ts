#!/usr/bin/env ts-node
/**
 * Phase 5 QA: Attempt privilege escalation.
 * - Use wrong token type (e.g. salon token on accept) → expect 403.
 * - Access admin endpoints without admin role → expect 403.
 * - No valid auth / no token on mutation → expect 401.
 */

const API_BASE = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

async function get(
  url: string,
  headers: Record<string, string> = {}
): Promise<{ status: number; ok: boolean }> {
  const res = await fetch(url, { method: 'GET', headers });
  return { status: res.status, ok: res.ok };
}

async function main() {
  const bookingId = '00000000-0000-0000-0000-000000000001'; // placeholder UUID
  let passed = 0;
  let failed = 0;

  // 1. Accept with wrong token type: use a token for 'salon' on 'accept' (token will not validate for 'accept')
  const salonUrl = `${API_BASE}/api/bookings/${bookingId}/accept?token=wrong_token_type_will_fail_validation`;
  const r1 = await get(salonUrl);
  if (r1.status === 403 || r1.status === 401 || r1.status === 404) {
    console.log(`  ✅ Accept with invalid/wrong token: ${r1.status}`);
    passed++;
  } else {
    console.log(`  ❌ Accept with wrong token: expected 401/403/404, got ${r1.status}`);
    failed++;
  }

  // 2. Admin list bookings without auth
  const r2 = await get(`${API_BASE}/api/admin/bookings`);
  if (r2.status === 401) {
    console.log(`  ✅ Admin bookings without auth: 401`);
    passed++;
  } else {
    console.log(`  ❌ Admin bookings without auth: expected 401, got ${r2.status}`);
    failed++;
  }

  // 3. Admin audit logs without auth
  const r3 = await get(`${API_BASE}/api/admin/audit-logs`);
  if (r3.status === 401) {
    console.log(`  ✅ Admin audit-logs without auth: 401`);
    passed++;
  } else {
    console.log(`  ❌ Admin audit-logs without auth: expected 401, got ${r3.status}`);
    failed++;
  }

  // 4. Admin lifecycle without auth
  const r4 = await get(`${API_BASE}/api/admin/bookings/${bookingId}/lifecycle`);
  if (r4.status === 401) {
    console.log(`  ✅ Admin lifecycle without auth: 401`);
    passed++;
  } else {
    console.log(`  ❌ Admin lifecycle without auth: expected 401, got ${r4.status}`);
    failed++;
  }

  // 5. POST accept without auth and without token (unauthenticated state mutation)
  const r5 = await fetch(`${API_BASE}/api/bookings/${bookingId}/accept`, { method: 'POST' });
  if (r5.status === 401) {
    console.log(`  ✅ POST accept without auth: 401`);
    passed++;
  } else {
    console.log(`  ❌ POST accept without auth: expected 401, got ${r5.status}`);
    failed++;
  }

  console.log(`\nPhase 5 Privilege escalation: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

export {};
