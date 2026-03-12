#!/usr/bin/env ts-node
/**
 * Unit tests: lib/utils/cn (classname utility)
 * Pure function; no mocks.
 */

import { cn } from '../../lib/utils/cn';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function runTest(name: string, fn: () => void): void {
  fn();
  console.log(`  ✅ ${name}`);
}

export function runUnitUtilsCnTests(): void {
  console.log('\n--- unit: lib/utils/cn ---\n');

  runTest('cn returns single string when one class passed', () => {
    const out = cn('foo');
    assert(out === 'foo', `Expected 'foo', got '${out}'`);
  });

  runTest('cn joins multiple strings with space', () => {
    const out = cn('foo', 'bar', 'baz');
    assert(out === 'foo bar baz', `Expected 'foo bar baz', got '${out}'`);
  });

  runTest('cn filters out undefined and null', () => {
    const out = cn('foo', undefined, 'bar', null, 'baz');
    assert(out === 'foo bar baz', `Expected 'foo bar baz', got '${out}'`);
  });

  runTest('cn filters out false', () => {
    const out = cn('foo', false, 'bar');
    assert(out === 'foo bar', `Expected 'foo bar', got '${out}'`);
  });

  runTest('cn includes keys with true value in object', () => {
    const out = cn({ active: true, disabled: false, hidden: true });
    assert(
      out === 'active hidden' || out === 'hidden active',
      `Expected 'active hidden' (order may vary), got '${out}'`
    );
  });

  runTest('cn mixes strings and object conditional', () => {
    const out = cn('base', { active: true, disabled: false });
    assert(
      out.includes('base') && out.includes('active') && !out.includes('disabled'),
      `Expected 'base active', got '${out}'`
    );
  });

  runTest('cn returns empty string when all falsy', () => {
    const out = cn(undefined, null, false, { a: false });
    assert(out === '', `Expected '', got '${out}'`);
  });

  runTest('cn handles empty object', () => {
    const out = cn('x', {});
    assert(out === 'x', `Expected 'x', got '${out}'`);
  });

  runTest('cn is deterministic for same inputs', () => {
    const a = cn('a', { b: true }, 'c');
    const b = cn('a', { b: true }, 'c');
    assert(a === b, `Expected same output, got '${a}' vs '${b}'`);
  });
}

if (require.main === module) {
  runUnitUtilsCnTests();
  console.log('\n✅ unit-utils-cn: all passed\n');
}
