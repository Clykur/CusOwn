#!/usr/bin/env ts-node
/**
 * Unit tests: Reschedule + cancellation rules engine.
 * State transition enforcement, cancellation window constants, error message mapping.
 */

import { bookingStateMachine } from '../../lib/state/booking-state-machine';
import { ERROR_MESSAGES } from '../../config/constants';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function runTest(name: string, fn: () => void): void {
  fn();
  console.log(`  ✅ ${name}`);
}

export function runUnitRescheduleCancellationTests(): void {
  console.log('\n--- unit: reschedule & cancellation rules ---\n');

  runTest('cancel allowed from pending', () => {
    assert(
      bookingStateMachine.canTransition('pending', 'cancel'),
      'pending -> cancel must be allowed'
    );
  });

  runTest('cancel allowed from confirmed', () => {
    assert(
      bookingStateMachine.canTransition('confirmed', 'cancel'),
      'confirmed -> cancel must be allowed'
    );
  });

  runTest('cancel not allowed from cancelled', () => {
    assert(
      !bookingStateMachine.canTransition('cancelled', 'cancel'),
      'cancelled -> cancel must be disallowed'
    );
  });

  runTest('cancel not allowed from rejected', () => {
    assert(
      !bookingStateMachine.canTransition('rejected', 'cancel'),
      'rejected -> cancel must be disallowed'
    );
  });

  runTest('RESCHEDULE_MAX_EXCEEDED constant exists for API mapping', () => {
    assert(
      typeof ERROR_MESSAGES.RESCHEDULE_MAX_EXCEEDED === 'string',
      'RESCHEDULE_MAX_EXCEEDED must be defined'
    );
    assert(
      ERROR_MESSAGES.RESCHEDULE_MAX_EXCEEDED.length > 0,
      'RESCHEDULE_MAX_EXCEEDED must be non-empty'
    );
  });

  runTest('CANCELLATION_TOO_LATE used for late customer cancel', () => {
    assert(
      typeof ERROR_MESSAGES.CANCELLATION_TOO_LATE === 'string',
      'CANCELLATION_TOO_LATE must be defined'
    );
  });

  runTest('expire allowed from pending', () => {
    assert(
      bookingStateMachine.canTransition('pending', 'expire'),
      'pending -> expire must be allowed'
    );
  });

  runTest('confirm allowed from pending only', () => {
    assert(bookingStateMachine.canTransition('pending', 'confirm'), 'pending -> confirm allowed');
    assert(
      !bookingStateMachine.canTransition('confirmed', 'confirm'),
      'confirmed -> confirm disallowed'
    );
  });
}

if (require.main === module) {
  runUnitRescheduleCancellationTests();
  console.log('\n✅ unit-reschedule-cancellation: all passed\n');
}
