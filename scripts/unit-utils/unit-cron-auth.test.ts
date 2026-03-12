#!/usr/bin/env ts-node

import { NextRequest } from 'next/server';
import { validateCronSecret } from '../../lib/security/cron-auth';
import { env } from '../../config/env';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function runTest(name: string, fn: () => void): void {
  fn();
  console.log(`  ✅ ${name}`);
}

export function runUnitCronAuthTests(): void {
  console.log('\n--- unit: lib/security/cron-auth ---\n');

  runTest('validateCronSecret returns 401 when Authorization header is missing', () => {
    if (!env.cron.secret) return;
    const req = new NextRequest('http://localhost/api/cron/health-check', {
      method: 'GET',
    });
    const res = validateCronSecret(req);
    assert(res !== null, 'Expected response');
    assert(res?.status === 401, `Expected 401, got ${res?.status}`);
  });

  runTest('validateCronSecret returns 401 when Bearer token does not match', () => {
    if (!env.cron.secret) return;
    const req = new NextRequest('http://localhost/api/cron/health-check', {
      method: 'GET',
      headers: { authorization: 'Bearer wrong-secret' },
    });
    const res = validateCronSecret(req);
    assert(res !== null, 'Expected response');
    assert(res?.status === 401, `Expected 401, got ${res?.status}`);
  });

  runTest('validateCronSecret returns null when Bearer token matches configured secret', () => {
    const secret = env.cron.secret;
    if (!secret) return;
    const req = new NextRequest('http://localhost/api/cron/health-check', {
      method: 'GET',
      headers: { authorization: `Bearer ${secret}` },
    });
    const res = validateCronSecret(req);
    assert(res === null, `Expected null (allowed), got ${res?.status}`);
  });

  runTest('validateCronSecret returns 401 when header is present but not Bearer', () => {
    if (!env.cron.secret) return;
    const req = new NextRequest('http://localhost/api/cron/health-check', {
      method: 'GET',
      headers: { authorization: 'Basic xyz' },
    });
    const res = validateCronSecret(req);
    assert(res !== null && res.status === 401, 'Expected 401 for non-Bearer');
  });
}

if (require.main === module) {
  runUnitCronAuthTests();
  console.log('\n✅ unit-cron-auth: all passed\n');
}
