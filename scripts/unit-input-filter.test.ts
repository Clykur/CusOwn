#!/usr/bin/env ts-node
/**
 * Unit tests: lib/security/input-filter
 * filterFields, validateStringLength, validateEnum.
 */

import {
  filterFields,
  filterBookingUpdateFields,
  filterBusinessUpdateFields,
  filterUserProfileUpdateFields,
  validateStringLength,
  validateEnum,
} from '../lib/security/input-filter';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function runTest(name: string, fn: () => void): void {
  fn();
  console.log(`  ✅ ${name}`);
}

export function runUnitInputFilterTests(): void {
  console.log('\n--- unit: lib/security/input-filter ---\n');

  runTest('should_filterFields_include_only_allowed_keys_when_extra_keys_present', () => {
    const data = { a: 1, b: 2, c: 3 };
    const allowed = ['a', 'b'] as const;
    const out = filterFields(data, allowed);
    assert(
      out.a === 1 && out.b === 2 && !('c' in out),
      `Expected {a, b}, got ${JSON.stringify(out)}`
    );
  });

  runTest('should_filterFields_return_empty_object_when_allowed_empty', () => {
    const data = { a: 1, b: 2 };
    const allowed: (keyof typeof data)[] = [];
    const out = filterFields(data, allowed);
    assert(Object.keys(out).length === 0, `Expected {}, got ${JSON.stringify(out)}`);
  });

  runTest('should_filterBookingUpdateFields_allow_status_customer_name_phone', () => {
    const body = {
      status: 'confirmed',
      customer_name: 'Jane',
      customer_phone: '+919876543210',
      evil: 'drop',
    };
    const out = filterBookingUpdateFields(body);
    assert(
      out.status === 'confirmed' && out.customer_name === 'Jane',
      `Expected status/name, got ${JSON.stringify(out)}`
    );
    assert(!('evil' in out), 'Expected evil key dropped');
  });

  runTest('should_filterBusinessUpdateFields_allow_salon_name_slot_duration', () => {
    const body = { salon_name: 'Salon X', slot_duration: 30, extra: 'drop' };
    const out = filterBusinessUpdateFields(body);
    assert(
      out.salon_name === 'Salon X' && out.slot_duration === 30,
      `Expected salon_name/slot_duration, got ${JSON.stringify(out)}`
    );
    assert(!('extra' in out), 'Expected extra key dropped');
  });

  runTest('should_filterUserProfileUpdateFields_allow_user_type_full_name', () => {
    const body = {
      user_type: 'owner',
      full_name: 'John',
      phone_number: '+919876543210',
    };
    const out = filterUserProfileUpdateFields(body);
    assert(
      out.user_type === 'owner' && out.full_name === 'John',
      `Expected user_type/full_name, got ${JSON.stringify(out)}`
    );
  });

  runTest('should_validateStringLength_return_true_when_within_max', () => {
    assert(validateStringLength('hello', 10) === true, 'Expected true');
    assert(validateStringLength('hello', 5) === true, 'Expected true at boundary');
  });

  runTest('should_validateStringLength_return_false_when_exceeds_max', () => {
    assert(validateStringLength('hello', 3) === false, 'Expected false');
  });

  runTest('should_validateStringLength_return_false_when_not_string', () => {
    assert(validateStringLength(123 as any, 10) === false, 'Expected false');
  });

  runTest('should_validateEnum_return_true_when_value_in_allowed', () => {
    const allowed = ['pending', 'confirmed', 'rejected'] as const;
    assert(validateEnum('confirmed', allowed) === true, 'Expected true');
  });

  runTest('should_validateEnum_return_false_when_value_not_in_allowed', () => {
    const allowed = ['pending', 'confirmed'] as const;
    assert(validateEnum('invalid', allowed) === false, 'Expected false');
  });

  runTest('should_validateEnum_return_false_when_not_string', () => {
    const allowed = ['a', 'b'] as const;
    assert(validateEnum(123, allowed) === false, 'Expected false');
  });
}

if (require.main === module) {
  runUnitInputFilterTests();
  console.log('\n✅ unit-input-filter: all passed\n');
}
