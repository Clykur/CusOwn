#!/usr/bin/env ts-node
/**
 * Unit tests: lib/time/ist
 * getISTDate, getISTDateString, toMinutes. Deterministic where applicable.
 */

import { getISTDate, getISTDateString, toMinutes } from '../../lib/time/ist';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function runTest(name: string, fn: () => void): void {
  fn();
  console.log(`  ✅ ${name}`);
}

export function runUnitTimeIstTests(): void {
  console.log('\n--- unit: lib/time/ist ---\n');

  runTest('getISTDate returns Date instance', () => {
    const out = getISTDate();
    assert(out instanceof Date, 'Expected Date instance');
  });

  runTest('getISTDateString returns YYYY-MM-DD format', () => {
    const out = getISTDateString();
    assert(/^\d{4}-\d{2}-\d{2}$/.test(out), `Expected YYYY-MM-DD, got '${out}'`);
  });

  runTest('toMinutes returns 0 for null and undefined', () => {
    assert(toMinutes(null) === 0, 'null');
    assert(toMinutes(undefined) === 0, 'undefined');
  });

  runTest('toMinutes parses HH:MM to minutes', () => {
    assert(toMinutes('00:00') === 0, '00:00 -> 0');
    assert(toMinutes('01:00') === 60, '01:00 -> 60');
    assert(toMinutes('09:30') === 9 * 60 + 30, '09:30 -> 570');
    assert(toMinutes('23:59') === 23 * 60 + 59, '23:59');
  });

  runTest('toMinutes handles single digit hours and minutes', () => {
    assert(toMinutes('9:5') === 9 * 60 + 5, '9:5 -> 545');
  });

  runTest('toMinutes returns number', () => {
    const out = toMinutes('12:00');
    assert(typeof out === 'number', 'Must be number');
    assert(out === 720, '12:00 -> 720');
  });
}

if (require.main === module) {
  runUnitTimeIstTests();
  console.log('\n✅ unit-time-ist: all passed\n');
}
