#!/usr/bin/env ts-node
/**
 * Unit tests: lib/state (booking, slot, payment state machines)
 * Pure logic only; no DB or services. Deterministic.
 */

import { bookingStateMachine } from '../lib/state/booking-state-machine';
import { slotStateMachine } from '../lib/state/slot-state-machine';
import { paymentStateMachine } from '../lib/state/payment-state-machine';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function runTest(name: string, fn: () => void): void {
  fn();
  console.log(`  ✅ ${name}`);
}

export function runUnitStateMachinesPureTests(): void {
  console.log('\n--- unit: lib/state (pure) ---\n');

  runTest('should_booking_canTransition_allow_pending_to_confirmed_when_event_confirm', () => {
    assert(bookingStateMachine.canTransition('pending', 'confirm') === true, 'Expected true');
  });

  runTest('should_booking_canTransition_allow_pending_to_rejected_when_event_reject', () => {
    assert(bookingStateMachine.canTransition('pending', 'reject') === true, 'Expected true');
  });

  runTest('should_booking_canTransition_deny_rejected_to_cancelled_when_event_cancel', () => {
    assert(bookingStateMachine.canTransition('rejected', 'cancel') === false, 'Expected false');
  });

  runTest('should_booking_getNextState_return_null_when_transition_allowed_false', () => {
    assert(bookingStateMachine.getNextState('rejected', 'cancel') === null, 'Expected null');
  });

  runTest('should_booking_validateTransition_return_false_when_transition_allowed_false', () => {
    assert(
      bookingStateMachine.validateTransition('rejected', 'cancelled', 'cancel') === false,
      'Expected false'
    );
  });

  runTest('should_booking_getNextState_return_confirmed_when_pending_confirm', () => {
    const next = bookingStateMachine.getNextState('pending', 'confirm');
    assert(next === 'confirmed', `Expected 'confirmed', got '${next}'`);
  });

  runTest('should_booking_getNextState_return_null_when_invalid_transition', () => {
    const next = bookingStateMachine.getNextState('confirmed', 'expire');
    assert(next === null, `Expected null, got '${next}'`);
  });

  runTest('should_booking_validateTransition_return_true_when_valid', () => {
    assert(
      bookingStateMachine.validateTransition('pending', 'confirmed', 'confirm') === true,
      'Expected true'
    );
  });

  runTest('should_slot_canTransition_allow_available_to_reserved_when_event_reserve', () => {
    assert(slotStateMachine.canTransition('available', 'reserve') === true, 'Expected true');
  });

  runTest('should_slot_canTransition_deny_available_to_booked_when_event_book', () => {
    assert(slotStateMachine.canTransition('available', 'book') === false, 'Expected false');
  });

  runTest('should_slot_getNextState_return_reserved_when_available_reserve', () => {
    const next = slotStateMachine.getNextState('available', 'reserve');
    assert(next === 'reserved', `Expected 'reserved', got '${next}'`);
  });

  runTest('should_slot_getNextState_return_available_when_reserved_release', () => {
    const next = slotStateMachine.getNextState('reserved', 'release');
    assert(next === 'available', `Expected 'available', got '${next}'`);
  });

  runTest('should_payment_canTransition_allow_initiated_to_completed_when_event_verify', () => {
    assert(paymentStateMachine.canTransition('initiated', 'verify') === true, 'Expected true');
  });

  runTest('should_payment_canTransition_allow_initiated_to_failed_when_event_fail', () => {
    assert(paymentStateMachine.canTransition('initiated', 'fail') === true, 'Expected true');
  });

  runTest('should_payment_canTransition_deny_completed_to_failed_when_event_fail', () => {
    assert(paymentStateMachine.canTransition('completed', 'fail') === false, 'Expected false');
  });

  runTest('should_payment_getNextState_return_completed_when_initiated_verify', () => {
    const next = paymentStateMachine.getNextState('initiated', 'verify');
    assert(next === 'completed', `Expected 'completed', got '${next}'`);
  });

  runTest('should_payment_getNextState_return_refunded_when_completed_refund', () => {
    const next = paymentStateMachine.getNextState('completed', 'refund');
    assert(
      next === 'refunded' || next === 'partially_refunded',
      `Expected refunded variant, got '${next}'`
    );
  });

  runTest('should_booking_validateTransition_return_false_when_to_mismatch', () => {
    assert(
      bookingStateMachine.validateTransition('pending', 'rejected', 'confirm') === false,
      'Expected false when to does not match transition'
    );
  });

  runTest('should_slot_validateTransition_return_false_when_to_mismatch', () => {
    assert(
      slotStateMachine.validateTransition('available', 'booked', 'reserve') === false,
      'Expected false when to does not match'
    );
  });

  runTest('should_payment_validateTransition_return_false_when_to_mismatch', () => {
    assert(
      paymentStateMachine.validateTransition('initiated', 'refunded', 'verify') === false,
      'Expected false when to does not match'
    );
  });

  runTest('should_booking_canTransition_return_false_when_no_matching_transition', () => {
    assert(bookingStateMachine.canTransition('cancelled', 'confirm') === false, 'Expected false');
  });

  runTest('should_booking_getNextState_return_null_when_no_matching_transition', () => {
    assert(bookingStateMachine.getNextState('cancelled', 'confirm') === null, 'Expected null');
  });

  runTest('should_booking_validateTransition_return_false_when_no_transition', () => {
    assert(
      bookingStateMachine.validateTransition('cancelled', 'confirmed', 'confirm') === false,
      'Expected false'
    );
  });

  runTest('should_slot_canTransition_return_false_when_no_matching_transition', () => {
    assert(slotStateMachine.canTransition('available', 'book') === false, 'Expected false');
  });

  runTest('should_slot_getNextState_return_null_when_no_matching_transition', () => {
    assert(slotStateMachine.getNextState('available', 'book') === null, 'Expected null');
  });

  runTest('should_slot_validateTransition_return_false_when_no_transition', () => {
    assert(
      slotStateMachine.validateTransition('available', 'booked', 'book') === false,
      'Expected false'
    );
  });

  runTest('should_slot_validateTransition_return_false_when_transition_allowed_false', () => {
    assert(
      slotStateMachine.validateTransition('available', 'available', 'release') === false,
      'Expected false'
    );
  });

  runTest('should_slot_canTransition_return_false_when_transition_allowed_false', () => {
    assert(slotStateMachine.canTransition('available', 'release') === false, 'Expected false');
  });

  runTest('should_payment_canTransition_return_false_when_no_matching_transition', () => {
    assert(paymentStateMachine.canTransition('refunded', 'verify') === false, 'Expected false');
  });

  runTest('should_payment_getNextState_return_null_when_no_matching_transition', () => {
    assert(paymentStateMachine.getNextState('refunded', 'verify') === null, 'Expected null');
  });

  runTest('should_payment_validateTransition_return_false_when_no_transition', () => {
    assert(
      paymentStateMachine.validateTransition('refunded', 'completed', 'verify') === false,
      'Expected false'
    );
  });

  runTest('should_payment_validateTransition_return_false_when_transition_allowed_false', () => {
    assert(
      paymentStateMachine.validateTransition('failed', 'failed', 'verify') === false,
      'Expected false'
    );
  });

  runTest('should_payment_canTransition_return_false_when_transition_allowed_false', () => {
    assert(paymentStateMachine.canTransition('failed', 'verify') === false, 'Expected false');
  });
}

if (require.main === module) {
  runUnitStateMachinesPureTests();
  console.log('\n✅ unit-state-machines-pure: all passed\n');
}
