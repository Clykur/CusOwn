#!/usr/bin/env ts-node
/**
 * Unit tests: config/policies
 * Assert locked-scope policy exports and invariants.
 */

import {
  PHASE1_PAYMENT_BOOKING_POLICY,
  PHASE1_SCOPE_LOCKED,
} from '../config/policies/booking-invariants.policy';
import {
  PHASE2_PAYMENT_HANDLERS_DO_NOT_MODIFY_BOOKING,
  PHASE2_SCOPE_LOCKED,
} from '../config/policies/payment-audit-replay.policy';
import {
  PHASE3_LAZY_EXPIRE_SOURCE_CRON,
  PHASE3_LAZY_EXPIRE_SOURCE_LAZY_HEAL,
  PHASE3_SCOPE_LOCKED,
} from '../config/policies/cron-self-heal-metrics.policy';
import { PHASE4_SCOPE_LOCKED } from '../config/policies/observability-lifecycle.policy';
import { PHASE5_SCOPE_LOCKED } from '../config/policies/security-compliance.policy';
import { PHASE6_SCOPE_LOCKED } from '../config/policies/ux-release-safety.policy';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function runTest(name: string, fn: () => void): void {
  fn();
  console.log(`  ✅ ${name}`);
}

export function runUnitConfigPoliciesTests(): void {
  console.log('\n--- unit: config/policies ---\n');

  runTest('should_phase1_payment_booking_policy_be_optional', () => {
    assert(
      PHASE1_PAYMENT_BOOKING_POLICY === 'optional',
      `Expected 'optional', got '${PHASE1_PAYMENT_BOOKING_POLICY}'`
    );
  });

  runTest('should_phase1_scope_be_locked', () => {
    assert(PHASE1_SCOPE_LOCKED === true, 'Expected true');
  });

  runTest('should_phase2_payment_handlers_do_not_modify_booking', () => {
    assert(PHASE2_PAYMENT_HANDLERS_DO_NOT_MODIFY_BOOKING === true, 'Expected true');
  });

  runTest('should_phase2_scope_be_locked', () => {
    assert(PHASE2_SCOPE_LOCKED === true, 'Expected true');
  });

  runTest('should_phase3_lazy_expire_sources_be_defined', () => {
    assert(PHASE3_LAZY_EXPIRE_SOURCE_CRON === 'cron', 'Expected cron');
    assert(PHASE3_LAZY_EXPIRE_SOURCE_LAZY_HEAL === 'lazy_heal', 'Expected lazy_heal');
  });

  runTest('should_phase3_scope_be_locked', () => {
    assert(PHASE3_SCOPE_LOCKED === true, 'Expected true');
  });

  runTest('should_phase4_scope_be_locked', () => {
    assert(PHASE4_SCOPE_LOCKED === true, 'Expected true');
  });

  runTest('should_phase5_scope_be_locked', () => {
    assert(PHASE5_SCOPE_LOCKED === true, 'Expected true');
  });

  runTest('should_phase6_scope_be_locked', () => {
    assert(PHASE6_SCOPE_LOCKED === true, 'Expected true');
  });
}

if (require.main === module) {
  runUnitConfigPoliciesTests();
  console.log('\n✅ unit-config-policies: all passed\n');
}
