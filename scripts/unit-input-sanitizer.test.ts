#!/usr/bin/env ts-node
/**
 * Unit tests: lib/security/input-sanitizer
 * Pure sanitizers; deterministic.
 */

import {
  sanitizeString,
  sanitizeNumber,
  sanitizeInteger,
  sanitizeEmail,
  sanitizePhone,
  sanitizeUUID,
  sanitizeDate,
  sanitizeTime,
  sanitizeObject,
  sanitizeRequestBody,
} from '../lib/security/input-sanitizer';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function runTest(name: string, fn: () => void): void {
  fn();
  console.log(`  ✅ ${name}`);
}

export function runUnitInputSanitizerTests(): void {
  console.log('\n--- unit: lib/security/input-sanitizer ---\n');

  runTest('should_sanitizeString_return_empty_when_not_string', () => {
    assert((sanitizeString as any)(123) === '', 'Expected empty string');
  });

  runTest('should_sanitizeString_trim_and_remove_script_like_content', () => {
    const out = sanitizeString('  <script>alert(1)</script>  ');
    assert(!out.includes('<') && !out.includes('>'), `Expected no angle brackets: '${out}'`);
  });

  runTest('should_sanitizeNumber_return_number_when_valid_string', () => {
    assert(sanitizeNumber('42') === 42, `Expected 42, got ${sanitizeNumber('42')}`);
    assert(sanitizeNumber('3.14') === 3.14, `Expected 3.14, got ${sanitizeNumber('3.14')}`);
  });

  runTest('should_sanitizeNumber_return_null_when_invalid', () => {
    assert(sanitizeNumber('abc') === null, 'Expected null');
    assert(sanitizeNumber(NaN) === null, 'Expected null for NaN');
  });

  runTest('should_sanitizeNumber_return_number_when_valid_number', () => {
    assert(sanitizeNumber(42) === 42, 'Expected 42');
    assert(sanitizeNumber(3.14) === 3.14, 'Expected 3.14');
  });

  runTest('should_sanitizeNumber_return_null_when_Infinity', () => {
    assert(sanitizeNumber(Infinity) === null, 'Expected null for Infinity');
  });

  runTest('should_sanitizeNumber_return_null_when_not_number_or_string', () => {
    assert(sanitizeNumber(null) === null, 'Expected null for null');
    assert(sanitizeNumber(undefined) === null, 'Expected null for undefined');
    assert(sanitizeNumber(true) === null, 'Expected null for boolean');
    assert(sanitizeNumber({}) === null, 'Expected null for object');
  });

  runTest('should_sanitizeInteger_floor_decimal', () => {
    assert(sanitizeInteger(3.9) === 3, `Expected 3, got ${sanitizeInteger(3.9)}`);
  });

  runTest('should_sanitizeInteger_return_null_when_sanitizeNumber_returns_null', () => {
    assert(sanitizeInteger('abc') === null, 'Expected null');
    assert(sanitizeInteger(null) === null, 'Expected null for null');
  });

  runTest('should_sanitizeEmail_return_value_when_valid', () => {
    assert(sanitizeEmail('user@example.com') === 'user@example.com', 'Expected same');
  });

  runTest('should_sanitizeEmail_return_null_when_invalid', () => {
    assert(sanitizeEmail('not-an-email') === null, 'Expected null');
  });

  runTest('should_sanitizePhone_return_value_when_valid_e164_like', () => {
    assert(sanitizePhone('+919876543210') === '+919876543210', 'Expected same');
  });

  runTest('should_sanitizePhone_return_null_when_invalid', () => {
    assert(sanitizePhone('abc') === null, 'Expected null for non-numeric');
  });

  runTest('should_sanitizeUUID_return_value_when_valid_uuid', () => {
    const uuid = '11111111-1111-4111-a111-111111111111';
    assert(sanitizeUUID(uuid) === uuid, 'Expected same');
  });

  runTest('should_sanitizeUUID_return_null_when_invalid', () => {
    assert(sanitizeUUID('not-uuid') === null, 'Expected null');
  });

  runTest('should_sanitizeDate_return_YYYY_MM_DD_when_valid', () => {
    assert(sanitizeDate('2025-01-15') === '2025-01-15', 'Expected same');
  });

  runTest('should_sanitizeDate_return_null_when_invalid_format', () => {
    assert(sanitizeDate('01/15/2025') === null, 'Expected null');
  });

  runTest('should_sanitizeDate_return_null_when_regex_valid_but_invalid_calendar', () => {
    assert(sanitizeDate('2025-13-01') === null, 'Expected null for invalid month');
  });

  runTest('should_sanitizeTime_return_value_when_HH_MM_SS', () => {
    assert(sanitizeTime('09:30:00') === '09:30:00', 'Expected same');
  });

  runTest('should_sanitizeTime_return_null_when_invalid', () => {
    assert(sanitizeTime('9:30') === null, 'Expected null for missing leading zero');
  });

  runTest('should_sanitizeObject_include_only_sanitized_values', () => {
    const obj = { name: '  John  ', age: '30', extra: 'ignored' };
    const schema = {
      name: (v: unknown) => (typeof v === 'string' ? v.trim() : null),
      age: (v: unknown) => (typeof v === 'string' ? parseInt(v, 10) : null),
    };
    const out = sanitizeObject(obj, schema as any);
    assert((out as any).name === 'John', `Expected trimmed name, got ${(out as any).name}`);
    assert((out as any).age === 30, `Expected 30, got ${(out as any).age}`);
    assert(!('extra' in (out || {})), 'Extra key should not be in output');
  });

  runTest('should_sanitizeObject_omit_null_undefined_results', () => {
    const obj = { a: 'valid', b: 'invalid' };
    const schema = {
      a: () => 'kept',
      b: () => null,
    };
    const out = sanitizeObject(obj, schema as any);
    assert((out as any).a === 'kept', 'Expected a kept');
    assert(!('b' in (out || {})), 'b should be omitted');
  });

  runTest('should_sanitizeObject_skip_keys_not_in_obj', () => {
    const obj = { a: 1 };
    const schema = {
      a: (v: unknown) => v,
      b: (v: unknown) => v,
    };
    const out = sanitizeObject(obj, schema as any);
    assert((out as any).a === 1, 'Expected a');
    assert(!('b' in (out || {})), 'b should be omitted when not in obj');
  });

  runTest('should_sanitizeRequestBody_return_object_when_valid_json', async () => {
    const req = {
      json: async () => ({ foo: 'bar' }),
    } as any;
    const out = await sanitizeRequestBody(req);
    assert(out !== null && typeof out === 'object', 'Expected object');
    assert((out as any).foo === 'bar', 'Expected foo');
  });

  runTest('should_sanitizeRequestBody_return_null_when_not_object', async () => {
    const req = { json: async () => 'string' } as any;
    const out = await sanitizeRequestBody(req);
    assert(out === null, 'Expected null for non-object');
  });

  runTest('should_sanitizeRequestBody_return_null_when_array', async () => {
    const req = { json: async () => [] } as any;
    const out = await sanitizeRequestBody(req);
    assert(out === null, 'Expected null for array');
  });

  runTest('should_sanitizeRequestBody_return_null_on_parse_error', async () => {
    const req = {
      json: async () => {
        throw new Error('parse');
      },
    } as any;
    const out = await sanitizeRequestBody(req);
    assert(out === null, 'Expected null on error');
  });
}

if (require.main === module) {
  runUnitInputSanitizerTests();
  console.log('\n✅ unit-input-sanitizer: all passed\n');
}
