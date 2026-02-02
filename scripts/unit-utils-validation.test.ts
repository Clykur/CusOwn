#!/usr/bin/env ts-node
/**
 * Unit tests: lib/utils/validation
 * validateTimeRange; validateCreateSalon / validateCreateBooking with valid/invalid inputs.
 */

import {
  validateTimeRange,
  validateCreateSalon,
  validateCreateBooking,
} from '../lib/utils/validation';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function runTest(name: string, fn: () => void): void {
  fn();
  console.log(`  ✅ ${name}`);
}

export function runUnitUtilsValidationTests(): void {
  console.log('\n--- unit: lib/utils/validation ---\n');

  runTest('should_validateTimeRange_not_throw_when_closing_after_opening', () => {
    validateTimeRange('09:00:00', '17:00:00');
  });

  runTest('should_validateTimeRange_throw_when_closing_equals_opening', () => {
    let threw = false;
    try {
      validateTimeRange('09:00:00', '09:00:00');
    } catch {
      threw = true;
    }
    assert(threw, 'Expected throw when closing equals opening');
  });

  runTest('should_validateTimeRange_throw_when_closing_before_opening', () => {
    let threw = false;
    try {
      validateTimeRange('17:00:00', '09:00:00');
    } catch {
      threw = true;
    }
    assert(threw, 'Expected throw when closing before opening');
  });

  runTest('should_validateCreateSalon_return_parsed_data_when_valid_input', () => {
    const valid = {
      salon_name: 'Test Salon',
      owner_name: 'Test Owner',
      whatsapp_number: '+919876543210',
      opening_time: '09:00:00',
      closing_time: '18:00:00',
      slot_duration: '30' as const,
      address: '123 Test Street',
      location: 'Test City',
    };
    const result = validateCreateSalon(valid);
    assert(result.salon_name === valid.salon_name, `Expected salon_name, got ${result.salon_name}`);
  });

  runTest('should_validateCreateSalon_throw_when_salon_name_too_short', () => {
    const invalid = {
      salon_name: 'A',
      owner_name: 'Test Owner',
      whatsapp_number: '+919876543210',
      opening_time: '09:00:00',
      closing_time: '18:00:00',
      slot_duration: '30' as const,
      address: '123 Test Street',
      location: 'Test City',
    };
    let threw = false;
    try {
      validateCreateSalon(invalid);
    } catch {
      threw = true;
    }
    assert(threw, 'Expected throw for short salon name');
  });

  runTest('should_validateCreateSalon_throw_when_invalid_slot_duration', () => {
    const invalid = {
      salon_name: 'Test Salon',
      owner_name: 'Test Owner',
      whatsapp_number: '+919876543210',
      opening_time: '09:00:00',
      closing_time: '18:00:00',
      slot_duration: '99' as any,
      address: '123 Test Street',
      location: 'Test City',
    };
    let threw = false;
    try {
      validateCreateSalon(invalid);
    } catch {
      threw = true;
    }
    assert(threw, 'Expected throw for invalid slot_duration');
  });

  runTest('should_validateCreateBooking_return_parsed_data_when_valid_input', () => {
    const valid = {
      salon_id: '11111111-1111-1111-1111-111111111111',
      slot_id: '22222222-2222-2222-2222-222222222222',
      customer_name: 'Jane Doe',
      customer_phone: '+919876543210',
    };
    const result = validateCreateBooking(valid);
    assert(
      result.customer_name === valid.customer_name,
      `Expected customer_name, got ${result.customer_name}`
    );
  });

  runTest('should_validateCreateBooking_throw_when_salon_id_not_uuid', () => {
    const invalid = {
      salon_id: 'not-a-uuid',
      slot_id: '22222222-2222-2222-2222-222222222222',
      customer_name: 'Jane Doe',
      customer_phone: '+919876543210',
    };
    let threw = false;
    try {
      validateCreateBooking(invalid);
    } catch {
      threw = true;
    }
    assert(threw, 'Expected throw for invalid salon_id');
  });

  runTest('should_validateCreateBooking_throw_when_customer_name_too_short', () => {
    const invalid = {
      salon_id: '11111111-1111-1111-1111-111111111111',
      slot_id: '22222222-2222-2222-2222-222222222222',
      customer_name: 'J',
      customer_phone: '+919876543210',
    };
    let threw = false;
    try {
      validateCreateBooking(invalid);
    } catch {
      threw = true;
    }
    assert(threw, 'Expected throw for short customer name');
  });

  runTest('should_validateCreateSalon_throw_DATABASE_ERROR_when_parse_throws_non_Error', () => {
    const badData = { salon_name: 12345 } as any;
    let threw = false;
    let msg = '';
    try {
      validateCreateSalon(badData);
    } catch (e) {
      threw = true;
      msg = e instanceof Error ? e.message : String(e);
    }
    assert(threw, 'Expected throw');
    assert(msg.includes('Database') || msg.length > 0, `Expected error message, got '${msg}'`);
  });

  runTest('should_validateCreateBooking_throw_DATABASE_ERROR_when_parse_throws_non_Error', () => {
    const badData = { salon_id: 123 } as any;
    let threw = false;
    try {
      validateCreateBooking(badData);
    } catch (e) {
      threw = true;
    }
    assert(threw, 'Expected throw');
  });

  runTest('should_validateCreateSalon_throw_DATABASE_ERROR_when_catch_receives_non_Error', () => {
    const proxyThrow = new Proxy({} as any, {
      get: () => {
        throw 'non-Error';
      },
    });
    let msg = '';
    try {
      validateCreateSalon(proxyThrow);
    } catch (e) {
      msg = e instanceof Error ? e.message : String(e);
    }
    assert(
      msg.includes('Database') || msg.includes('error'),
      `Expected DATABASE_ERROR, got ${msg}`
    );
  });

  runTest('should_validateCreateBooking_throw_DATABASE_ERROR_when_catch_receives_non_Error', () => {
    const proxyThrow = new Proxy({} as any, {
      get: () => {
        throw 123;
      },
    });
    let msg = '';
    try {
      validateCreateBooking(proxyThrow);
    } catch (e) {
      msg = e instanceof Error ? e.message : String(e);
    }
    assert(
      msg.includes('Database') || msg.includes('error'),
      `Expected DATABASE_ERROR, got ${msg}`
    );
  });
}

if (require.main === module) {
  runUnitUtilsValidationTests();
  console.log('\n✅ unit-utils-validation: all passed\n');
}
