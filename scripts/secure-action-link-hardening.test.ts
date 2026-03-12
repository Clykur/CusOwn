#!/usr/bin/env ts-node

import { NextRequest } from 'next/server';
import { generateResourceToken, validateResourceToken } from '@/lib/utils/security';
import { enhancedRateLimit } from '@/lib/security/rate-limit-api.security';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function runTest(name: string, fn: () => void): void {
  fn();
  console.log(`  ✅ ${name}`);
}

async function runAsyncTest(name: string, fn: () => Promise<void>): Promise<void> {
  await fn();
  console.log(`  ✅ ${name}`);
}

const BOOKING_ID = '11111111-1111-4111-a111-111111111111';

export async function runSecureActionLinkHardeningTests(): Promise<void> {
  console.log('\n--- secure action link hardening ---\n');

  runTest('token_scope_accept_token_invalid_for_reject', () => {
    const now = Math.floor(Date.now() / 1000);
    const acceptToken = generateResourceToken('accept', BOOKING_ID, now);
    assert(acceptToken.length > 0, 'accept token should be generated');
    const validForReject = validateResourceToken('reject', BOOKING_ID, acceptToken);
    assert(validForReject === false, 'accept token must not validate for reject action');
  });

  runTest('token_scope_reject_token_invalid_for_accept', () => {
    const now = Math.floor(Date.now() / 1000);
    const rejectToken = generateResourceToken('reject', BOOKING_ID, now);
    assert(rejectToken.length > 0, 'reject token should be generated');
    const validForAccept = validateResourceToken('accept', BOOKING_ID, rejectToken);
    assert(validForAccept === false, 'reject token must not validate for accept action');
  });

  await runAsyncTest('rate_limit_exceeds_max_returns_429', async () => {
    const limiter = enhancedRateLimit({
      maxRequests: 2,
      windowMs: 60_000,
      perIP: true,
      keyPrefix: 'test_secure_link_rate_limit',
    });
    const url = 'http://localhost/api/bookings/123?token=abc';
    const req1 = new NextRequest(url, { headers: { 'x-forwarded-for': '10.0.0.99' } });
    const req2 = new NextRequest(url, { headers: { 'x-forwarded-for': '10.0.0.99' } });
    const req3 = new NextRequest(url, { headers: { 'x-forwarded-for': '10.0.0.99' } });
    const r1 = await limiter(req1);
    const r2 = await limiter(req2);
    const r3 = await limiter(req3);
    assert(r1 === null, 'first request should not be rate limited');
    assert(r2 === null, 'second request should not be rate limited');
    assert(r3 !== null && r3.status === 429, 'third request should be rate limited with 429');
  });

  await runAsyncTest('rate_limit_different_ip_not_limited', async () => {
    const limiter = enhancedRateLimit({
      maxRequests: 1,
      windowMs: 60_000,
      perIP: true,
      keyPrefix: 'test_secure_link_rate_limit_ip',
    });
    const url = 'http://localhost/api/bookings/123?token=abc';
    const reqA = new NextRequest(url, { headers: { 'x-forwarded-for': '10.0.0.1' } });
    const reqB = new NextRequest(url, { headers: { 'x-forwarded-for': '10.0.0.2' } });
    const rA = await limiter(reqA);
    const rB = await limiter(reqB);
    assert(rA === null, 'first IP should not be rate limited');
    assert(rB === null, 'different IP should not be rate limited');
  });
}

if (require.main === module) {
  runSecureActionLinkHardeningTests().then(
    () => process.exit(0),
    (err) => {
      console.error(err);
      process.exit(1);
    }
  );
}
