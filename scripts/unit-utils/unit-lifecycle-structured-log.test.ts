#!/usr/bin/env ts-node

import {
  logBookingLifecycle,
  logPaymentLifecycle,
  type BookingLifecycleAction,
  type PaymentLifecycleAction,
} from '../../lib/monitoring/lifecycle-structured-log';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function runTest(name: string, fn: () => void): void {
  fn();
  console.log(`  ✅ ${name}`);
}

export function runUnitLifecycleStructuredLogTests(): void {
  console.log('\n--- unit: lib/monitoring/lifecycle-structured-log ---\n');

  runTest('logBookingLifecycle logs JSON with required fields', () => {
    const logs: string[] = [];
    const original = console.log;
    console.log = (...args: unknown[]) => {
      logs.push(args.map(String).join(' '));
    };
    try {
      logBookingLifecycle({
        booking_id: 'b1',
        slot_id: 's1',
        action: 'booking_created' as BookingLifecycleAction,
        actor: 'customer',
        source: 'api',
      });
      assert(logs.length === 1, `Expected 1 log line, got ${logs.length}`);
      assert(logs[0].includes('[LIFECYCLE_BOOKING]'), 'Expected booking prefix');
      const jsonStr = logs[0].replace(/^\[LIFECYCLE_BOOKING\]\s*/, '');
      const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
      assert(parsed.booking_id === 'b1', 'booking_id');
      assert(parsed.slot_id === 's1', 'slot_id');
      assert(parsed.action === 'booking_created', 'action');
      assert(parsed.actor === 'customer', 'actor');
      assert(parsed.source === 'api', 'source');
      assert(typeof parsed.timestamp === 'string', 'timestamp');
    } finally {
      console.log = original;
    }
  });

  runTest('logBookingLifecycle includes optional reason', () => {
    const logs: string[] = [];
    const original = console.log;
    console.log = (...args: unknown[]) => {
      logs.push(args.map(String).join(' '));
    };
    try {
      logBookingLifecycle({
        booking_id: 'b2',
        slot_id: 's2',
        action: 'booking_cancelled' as BookingLifecycleAction,
        actor: 'owner',
        source: 'api',
        reason: 'customer request',
      });
      const jsonStr = logs[0].replace(/^\[LIFECYCLE_BOOKING\]\s*/, '');
      const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
      assert(parsed.reason === 'customer request', 'reason');
    } finally {
      console.log = original;
    }
  });

  runTest('logPaymentLifecycle logs JSON with required fields', () => {
    const logs: string[] = [];
    const original = console.log;
    console.log = (...args: unknown[]) => {
      logs.push(args.map(String).join(' '));
    };
    try {
      logPaymentLifecycle({
        payment_id: 'p1',
        booking_id: 'b1',
        action: 'payment_succeeded' as PaymentLifecycleAction,
        actor: 'system',
      });
      assert(logs.length === 1, `Expected 1 log line, got ${logs.length}`);
      assert(logs[0].includes('[LIFECYCLE_PAYMENT]'), 'Expected payment prefix');
      const jsonStr = logs[0].replace(/^\[LIFECYCLE_PAYMENT\]\s*/, '');
      const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
      assert(parsed.payment_id === 'p1', 'payment_id');
      assert(parsed.booking_id === 'b1', 'booking_id');
      assert(parsed.action === 'payment_succeeded', 'action');
      assert(parsed.actor === 'system', 'actor');
      assert(typeof parsed.timestamp === 'string', 'timestamp');
    } finally {
      console.log = original;
    }
  });
}

if (require.main === module) {
  runUnitLifecycleStructuredLogTests();
  console.log('\n✅ unit-lifecycle-structured-log: all passed\n');
}
