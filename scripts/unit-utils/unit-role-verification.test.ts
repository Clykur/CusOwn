#!/usr/bin/env ts-node
/**
 * Unit tests: lib/utils/role-verification (sync pure functions only)
 * isAdminProfile, hasOwnerProfile, hasCustomerProfile. Async functions need profile passed to be testable.
 */

import {
  isAdminProfile,
  hasOwnerProfile,
  hasCustomerProfile,
  hasOwnerAccess,
  hasCustomerAccess,
  hasAdminAccess,
  type ProfileLike,
} from '../../lib/utils/role-verification';

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

export function runUnitRoleVerificationTests(): void {
  console.log('\n--- unit: lib/utils/role-verification ---\n');

  runTest('isAdminProfile returns true when user_type is admin', () => {
    assert(isAdminProfile({ user_type: 'admin' }) === true, 'Expected true for admin');
  });

  runTest('isAdminProfile returns false when user_type is owner', () => {
    assert(isAdminProfile({ user_type: 'owner' }) === false, 'Expected false for owner');
  });

  runTest('isAdminProfile returns false for null profile', () => {
    assert(isAdminProfile(null) === false, 'Expected false for null');
  });

  runTest('isAdminProfile returns false for undefined user_type', () => {
    assert(isAdminProfile({}) === false, 'Expected false for empty object');
  });

  runTest('hasOwnerProfile returns true for owner, both, admin', () => {
    assert(hasOwnerProfile({ user_type: 'owner' }) === true, 'owner');
    assert(hasOwnerProfile({ user_type: 'both' }) === true, 'both');
    assert(hasOwnerProfile({ user_type: 'admin' }) === true, 'admin');
  });

  runTest('hasOwnerProfile returns false for customer and null', () => {
    assert(hasOwnerProfile({ user_type: 'customer' }) === false, 'customer');
    assert(hasOwnerProfile(null) === false, 'null');
  });

  runTest('hasCustomerProfile returns true for customer, both, admin', () => {
    assert(hasCustomerProfile({ user_type: 'customer' }) === true, 'customer');
    assert(hasCustomerProfile({ user_type: 'both' }) === true, 'both');
    assert(hasCustomerProfile({ user_type: 'admin' }) === true, 'admin');
  });

  runTest('hasCustomerProfile returns false for owner and null', () => {
    assert(hasCustomerProfile({ user_type: 'owner' }) === false, 'owner');
    assert(hasCustomerProfile(null) === false, 'null');
  });
}

export async function runUnitRoleVerificationAsyncTests(): Promise<void> {
  runAsyncTest('hasOwnerAccess returns true when profile is owner and passed', async () => {
    const out = await hasOwnerAccess('user-1', { user_type: 'owner' });
    assert(out === true, `Expected true, got ${out}`);
  });

  runAsyncTest('hasOwnerAccess returns false when profile is customer and passed', async () => {
    const out = await hasOwnerAccess('user-1', { user_type: 'customer' });
    assert(out === false, `Expected false, got ${out}`);
  });

  runAsyncTest('hasCustomerAccess returns true when profile is customer and passed', async () => {
    const out = await hasCustomerAccess('user-1', { user_type: 'customer' });
    assert(out === true, `Expected true, got ${out}`);
  });

  runAsyncTest('hasAdminAccess returns true when profile is admin and passed', async () => {
    const out = await hasAdminAccess('user-1', { user_type: 'admin' });
    assert(out === true, `Expected true, got ${out}`);
  });

  runAsyncTest('hasAdminAccess returns false when profile is null and passed', async () => {
    const out = await hasAdminAccess('user-1', null);
    assert(out === false, `Expected false, got ${out}`);
  });
}

if (require.main === module) {
  runUnitRoleVerificationTests();
  runUnitRoleVerificationAsyncTests()
    .then(() => {
      console.log('\n✅ unit-role-verification: all passed\n');
      process.exit(0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
