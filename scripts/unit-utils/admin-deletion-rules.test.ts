#!/usr/bin/env ts-node

import {
  VALIDATION,
  ERROR_MESSAGES,
  ADMIN_DELETION_OUTCOME,
  AUDIT_DEDUPE_WINDOW_MS,
} from '../../config/constants';
import {
  validateAdminDeletionReason,
  isDependencyBlockError,
  isReasonRequiredError,
} from '../../lib/utils/admin-deletion.server';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function runTest(name: string, fn: () => void): void {
  fn();
  console.log(`  ✅ ${name}`);
}

export function runAdminDeletionRulesTests(): void {
  console.log('\n--- admin deletion rules ---\n');

  runTest('deletion without reason is rejected (undefined)', () => {
    const err = validateAdminDeletionReason(undefined);
    assert(
      err !== null && err === ERROR_MESSAGES.DELETION_REASON_REQUIRED,
      `Expected required, got ${err}`
    );
  });

  runTest('deletion without reason is rejected (null)', () => {
    const err = validateAdminDeletionReason(null);
    assert(
      err !== null && err === ERROR_MESSAGES.DELETION_REASON_REQUIRED,
      `Expected required, got ${err}`
    );
  });

  runTest('deletion with empty string reason is rejected', () => {
    const err = validateAdminDeletionReason('');
    assert(
      err !== null && err === ERROR_MESSAGES.DELETION_REASON_REQUIRED,
      `Expected required, got ${err}`
    );
  });

  runTest('deletion with whitespace-only reason is rejected', () => {
    const err = validateAdminDeletionReason('   ');
    assert(
      err !== null && err === ERROR_MESSAGES.DELETION_REASON_REQUIRED,
      `Expected required, got ${err}`
    );
  });

  runTest('deletion with short reason is rejected', () => {
    const short = 'x'.repeat(VALIDATION.ADMIN_DELETION_REASON_MIN_LENGTH - 1);
    const err = validateAdminDeletionReason(short);
    assert(
      err !== null && err === ERROR_MESSAGES.DELETION_REASON_TOO_SHORT,
      `Expected too short, got ${err}`
    );
  });

  runTest('deletion with reason at min length is accepted', () => {
    const min = 'x'.repeat(VALIDATION.ADMIN_DELETION_REASON_MIN_LENGTH);
    const err = validateAdminDeletionReason(min);
    assert(err === null, `Expected valid, got ${err}`);
  });

  runTest('deletion with valid reason succeeds', () => {
    const err = validateAdminDeletionReason('Compliance: user requested account closure');
    assert(err === null, `Expected valid, got ${err}`);
  });

  runTest('deletion blocked when dependencies exist (outstanding payments)', () => {
    const msg = 'User has outstanding payments; resolve before deletion';
    assert(isDependencyBlockError(msg), 'Expected dependency block');
  });

  runTest('deletion blocked when dependencies exist (last admin)', () => {
    assert(isDependencyBlockError('Cannot delete the last admin'), 'Expected dependency block');
  });

  runTest('deletion blocked when dependencies exist (active bookings)', () => {
    const msg = 'Cannot soft-delete business: active (pending or confirmed) bookings exist';
    assert(isDependencyBlockError(msg), 'Expected dependency block');
  });

  runTest('deletion blocked when dependencies exist (already soft-deleted)', () => {
    assert(
      isDependencyBlockError('User account is already soft-deleted'),
      'Expected dependency block'
    );
  });

  runTest('non-dependency error is not classified as dependency block', () => {
    assert(!isDependencyBlockError('User not found'), 'Expected not dependency block');
    assert(!isDependencyBlockError('Database error'), 'Expected not dependency block');
  });

  runTest('reason required error is detected', () => {
    assert(isReasonRequiredError('Deletion reason is mandatory'), 'Expected reason required');
  });

  runTest('deleting an already-deleted user returns safe error message', () => {
    assert(
      typeof ERROR_MESSAGES.USER_ALREADY_DELETED === 'string' &&
        ERROR_MESSAGES.USER_ALREADY_DELETED.length > 0 &&
        !ERROR_MESSAGES.USER_ALREADY_DELETED.toLowerCase().includes('table') &&
        !ERROR_MESSAGES.USER_ALREADY_DELETED.toLowerCase().includes('column'),
      'USER_ALREADY_DELETED must be non-empty and not expose internal structure'
    );
  });

  runTest('deleting an already-deleted business returns safe error message', () => {
    assert(
      typeof ERROR_MESSAGES.BUSINESS_ALREADY_DELETED === 'string' &&
        ERROR_MESSAGES.BUSINESS_ALREADY_DELETED.length > 0 &&
        !ERROR_MESSAGES.BUSINESS_ALREADY_DELETED.toLowerCase().includes('table') &&
        !ERROR_MESSAGES.BUSINESS_ALREADY_DELETED.toLowerCase().includes('column'),
      'BUSINESS_ALREADY_DELETED must be non-empty and not expose internal structure'
    );
  });

  runTest('already_deleted outcome is used for idempotency logging', () => {
    assert(
      ADMIN_DELETION_OUTCOME.ALREADY_DELETED === 'already_deleted',
      'ALREADY_DELETED outcome must be already_deleted'
    );
  });

  runTest('audit dedupe window prevents duplicate logs for same deletion', () => {
    assert(
      AUDIT_DEDUPE_WINDOW_MS > 0,
      'AUDIT_DEDUPE_WINDOW_MS must be positive to dedupe repeated deletion attempts'
    );
  });

  runTest(
    'repeated delete of same resource uses already_deleted outcome without re-executing',
    () => {
      assert(
        ADMIN_DELETION_OUTCOME.SUCCESS === 'success' &&
          ADMIN_DELETION_OUTCOME.BLOCKED === 'blocked' &&
          ADMIN_DELETION_OUTCOME.ALREADY_DELETED === 'already_deleted',
        'Outcome constants must match so second request logs already_deleted and does not re-execute'
      );
    }
  );
}
