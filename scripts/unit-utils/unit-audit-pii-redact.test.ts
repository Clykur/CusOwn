#!/usr/bin/env ts-node

import { redactPiiForAudit } from '../../lib/security/audit-pii-redact.security';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function runTest(name: string, fn: () => void): void {
  fn();
  console.log(`  ✅ ${name}`);
}

export function runUnitAuditPiiRedactTests(): void {
  console.log('\n--- unit: lib/security/audit-pii-redact.security ---\n');

  runTest('redactPiiForAudit returns null for null', () => {
    assert(redactPiiForAudit(null) === null, 'Expected null');
  });

  runTest('redactPiiForAudit returns undefined for undefined', () => {
    assert(redactPiiForAudit(undefined) === undefined, 'Expected undefined');
  });

  runTest('redactPiiForAudit redacts customer_name', () => {
    const out = redactPiiForAudit({ customer_name: 'John', id: 'x' });
    assert(
      out !== null && (out as Record<string, unknown>).customer_name === '[REDACTED]',
      'customer_name redacted'
    );
    assert((out as Record<string, unknown>).id === 'x', 'id preserved');
  });

  runTest('redactPiiForAudit redacts email, phone, name', () => {
    const out = redactPiiForAudit({
      email: 'a@b.com',
      phone: '+123',
      name: 'Jane',
      count: 1,
    });
    assert((out as Record<string, unknown>).email === '[REDACTED]', 'email redacted');
    assert((out as Record<string, unknown>).phone === '[REDACTED]', 'phone redacted');
    assert((out as Record<string, unknown>).name === '[REDACTED]', 'name redacted');
    assert((out as Record<string, unknown>).count === 1, 'count preserved');
  });

  runTest('redactPiiForAudit redacts nested PII', () => {
    const out = redactPiiForAudit({
      meta: { customer_email: 'x@y.com', internal_id: 'i1' },
    });
    const meta = (out as Record<string, unknown>).meta as Record<string, unknown>;
    assert(meta.customer_email === '[REDACTED]', 'nested customer_email redacted');
    assert(meta.internal_id === 'i1', 'nested non-PII preserved');
  });

  runTest('redactPiiForAudit redacts user_agent, ip_address, address', () => {
    const out = redactPiiForAudit({
      user_agent: 'Mozilla/5.0',
      ip_address: '127.0.0.1',
      address: '123 Main St',
      booking_id: 'b1',
    });
    assert((out as Record<string, unknown>).user_agent === '[REDACTED]', 'user_agent redacted');
    assert((out as Record<string, unknown>).ip_address === '[REDACTED]', 'ip_address redacted');
    assert((out as Record<string, unknown>).address === '[REDACTED]', 'address redacted');
    assert((out as Record<string, unknown>).booking_id === 'b1', 'booking_id preserved');
  });

  runTest('redactPiiForAudit does not mutate original object', () => {
    const orig = { email: 'a@b.com', id: '1' };
    const out = redactPiiForAudit(orig);
    assert(orig.email === 'a@b.com', 'Original unchanged');
    assert((out as Record<string, unknown>).email === '[REDACTED]', 'Copy redacted');
  });
}

if (require.main === module) {
  runUnitAuditPiiRedactTests();
  console.log('\n✅ unit-audit-pii-redact: all passed\n');
}
