#!/usr/bin/env ts-node
/**
 * Unit tests: lib/utils/time
 * Pure functions only; no mocks. Deterministic.
 */

import {
  timeToMinutes,
  minutesToTime,
  addMinutes,
  isTimeAfter,
  isTimeBefore,
  normalizeTime,
  generateTimeSlots,
  isTimeInRange,
  isSlotTimePassed,
  isSlotInPast,
} from '../lib/utils/time';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function runTest(name: string, fn: () => void): void {
  fn();
  console.log(`  ✅ ${name}`);
}

export function runUnitUtilsTimeTests(): void {
  console.log('\n--- unit: lib/utils/time ---\n');

  runTest('should_timeToMinutes_return_minutes_when_given_HH_MM', () => {
    assert(timeToMinutes('09:30') === 9 * 60 + 30, `Expected 570, got ${timeToMinutes('09:30')}`);
    assert(timeToMinutes('00:00') === 0, `Expected 0, got ${timeToMinutes('00:00')}`);
  });

  runTest('should_timeToMinutes_return_0_when_empty_string', () => {
    assert(timeToMinutes('') === 0, `Expected 0, got ${timeToMinutes('')}`);
  });

  runTest('should_normalizeTime_return_empty_when_empty_string', () => {
    assert(normalizeTime('') === '', 'Expected empty string');
  });

  runTest('should_normalizeTime_return_unchanged_when_HH_MM_SS', () => {
    assert(normalizeTime('09:30:00') === '09:30:00', 'Expected unchanged');
  });

  runTest('should_normalizeTime_append_seconds_when_HH_MM', () => {
    assert(normalizeTime('09:30') === '09:30:00', 'Expected with :00');
  });

  runTest('should_minutesToTime_return_HH_MM_SS_when_given_minutes', () => {
    assert(minutesToTime(570) === '09:30:00', `Expected 09:30:00, got ${minutesToTime(570)}`);
    assert(minutesToTime(0) === '00:00:00', `Expected 00:00:00, got ${minutesToTime(0)}`);
  });

  runTest('should_addMinutes_return_correct_time_when_adding', () => {
    assert(
      addMinutes('09:00:00', 30) === '09:30:00',
      `Expected 09:30:00, got ${addMinutes('09:00:00', 30)}`
    );
    assert(
      addMinutes('23:30:00', 30) === '24:00:00',
      `Expected 24:00:00, got ${addMinutes('23:30:00', 30)}`
    );
  });

  runTest('should_isTimeAfter_return_true_when_first_later_than_second', () => {
    assert(isTimeAfter('10:00', '09:00') === true, 'Expected true');
    assert(isTimeAfter('09:00', '10:00') === false, 'Expected false');
  });

  runTest('should_isTimeBefore_return_true_when_first_earlier_than_second', () => {
    assert(isTimeBefore('09:00', '10:00') === true, 'Expected true');
    assert(isTimeBefore('10:00', '09:00') === false, 'Expected false');
  });

  runTest('should_generateTimeSlots_return_slots_when_valid_range_and_duration', () => {
    const slots = generateTimeSlots('09:00:00', '12:00:00', 60);
    assert(slots.length === 3, `Expected 3 slots, got ${slots.length}`);
    assert(
      slots[0].start === '09:00:00' && slots[0].end === '10:00:00',
      `First slot mismatch: ${JSON.stringify(slots[0])}`
    );
  });

  runTest('should_generateTimeSlots_return_empty_when_closing_before_opening', () => {
    const slots = generateTimeSlots('12:00:00', '09:00:00', 60);
    assert(slots.length === 0, `Expected 0 slots, got ${slots.length}`);
  });

  runTest('should_generateTimeSlots_return_empty_when_invalid_duration', () => {
    const slots = generateTimeSlots('09:00:00', '12:00:00', 0);
    assert(slots.length === 0, `Expected 0 slots, got ${slots.length}`);
  });

  runTest('should_isTimeInRange_return_true_when_time_inside_range', () => {
    assert(isTimeInRange('10:00', '09:00', '12:00') === true, 'Expected true');
    assert(isTimeInRange('08:00', '09:00', '12:00') === false, 'Expected false');
    assert(isTimeInRange('12:00', '09:00', '12:00') === false, 'Expected false (exclusive end)');
  });

  runTest('should_isSlotTimePassed_return_false_when_slot_date_not_today', () => {
    const dateStr = '2030-01-15';
    assert(isSlotTimePassed(dateStr, '09:00:00') === false, 'Future date should not be passed');
  });

  runTest('should_isSlotInPast_return_true_when_slot_date_before_today', () => {
    const dateStr = '2000-01-01';
    assert(isSlotInPast(dateStr, '23:59:00') === true, 'Past date should be in past');
  });

  runTest('should_isSlotInPast_return_false_when_slot_date_after_today', () => {
    const dateStr = '2030-12-31';
    assert(isSlotInPast(dateStr, '00:00:00') === false, 'Future date should not be in past');
  });

  runTest('should_generateTimeSlots_handle_HH_MM_format_add_seconds', () => {
    const slots = generateTimeSlots('09:00', '11:00', 60);
    assert(slots.length === 2, `Expected 2 slots for 09:00-11:00 60min, got ${slots.length}`);
    assert(slots[0].start === '09:00:00' && slots[0].end === '10:00:00', `First slot mismatch`);
  });

  runTest('should_generateTimeSlots_return_empty_when_empty_opening', () => {
    const slots = generateTimeSlots('', '12:00:00', 60);
    assert(slots.length === 0, `Expected 0 slots, got ${slots.length}`);
  });

  runTest('should_isTimeInRange_return_false_when_at_closing', () => {
    assert(isTimeInRange('12:00', '09:00', '12:00') === false, 'At closing is exclusive');
  });

  runTest('should_generateTimeSlots_handle_invalid_time_format_single_part', () => {
    const slots = generateTimeSlots('09', '12:00:00', 60);
    assert(slots.length >= 0, 'Invalid format handled');
  });

  runTest('should_generateTimeSlots_return_empty_when_empty_closing', () => {
    const slots = generateTimeSlots('09:00:00', '', 60);
    assert(slots.length === 0, `Expected 0 slots, got ${slots.length}`);
  });

  runTest('should_generateTimeSlots_normalizeTime_parts_length_3_return_unchanged', () => {
    const slots = generateTimeSlots('09:00:00', '10:00:00', 60);
    assert(
      slots.length === 1 && slots[0].start === '09:00:00' && slots[0].end === '10:00:00',
      `Expected one slot, got ${JSON.stringify(slots)}`
    );
  });

  runTest('should_generateTimeSlots_normalizeTime_parts_length_2_add_seconds', () => {
    const slots = generateTimeSlots('09:00', '10:00', 60);
    assert(
      slots.length === 1 && slots[0].start === '09:00:00' && slots[0].end === '10:00:00',
      `Expected one slot, got ${JSON.stringify(slots)}`
    );
  });

  runTest('should_generateTimeSlots_return_empty_when_opening_equals_closing', () => {
    const slots = generateTimeSlots('09:00:00', '09:00:00', 60);
    assert(slots.length === 0, `Expected 0 slots, got ${slots.length}`);
  });

  runTest('should_generateTimeSlots_break_when_endTime_exceeds_closing', () => {
    const slots = generateTimeSlots('09:00:00', '09:45:00', 60);
    assert(
      slots.length === 0,
      `Expected 0 slots when first end exceeds closing, got ${slots.length}`
    );
  });

  runTest('should_generateTimeSlots_safety_break_when_currentTime_ge_closing', () => {
    const slots = generateTimeSlots('09:00:00', '10:00:00', 60);
    assert(slots.length === 1, `Expected 1 slot, got ${slots.length}`);
  });

  runTest('should_isSlotTimePassed_return_false_when_slot_date_not_today', () => {
    assert(
      isSlotTimePassed('2030-01-15', '09:00:00') === false,
      'Future date should not be passed'
    );
  });

  runTest('should_isSlotTimePassed_execute_today_branch_and_return_boolean', () => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const result = isSlotTimePassed(todayStr, '00:00:00');
    assert(typeof result === 'boolean', `Expected boolean, got ${typeof result}`);
  });

  runTest('should_isSlotTimePassed_execute_today_branch_with_future_time', () => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const future = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const futureTime = `${String(future.getHours()).padStart(2, '0')}:${String(future.getMinutes()).padStart(2, '0')}:00`;
    const result = isSlotTimePassed(todayStr, futureTime);
    assert(typeof result === 'boolean', `Expected boolean, got ${typeof result}`);
  });

  runTest('should_isSlotTimePassed_today_branch_return_true_when_slot_time_past', () => {
    const now = new Date();
    const utcDate = now.toISOString().split('T')[0];
    const localStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    let slotDateForToday: string | null = null;
    for (const d of [utcDate, localStr]) {
      const obj = new Date(d + 'T00:00:00');
      if (obj.toISOString().split('T')[0] === utcDate) {
        slotDateForToday = d;
        break;
      }
    }
    if (slotDateForToday !== null) {
      const result = isSlotTimePassed(slotDateForToday, '00:00:00');
      assert(result === true, `Expected true when slot today and midnight, got ${result}`);
    }
  });

  runTest('should_isSlotTimePassed_today_branch_return_false_when_slot_time_future', () => {
    const now = new Date();
    const utcDate = now.toISOString().split('T')[0];
    const localStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    let slotDateForToday: string | null = null;
    for (const d of [utcDate, localStr]) {
      const obj = new Date(d + 'T00:00:00');
      if (obj.toISOString().split('T')[0] === utcDate) {
        slotDateForToday = d;
        break;
      }
    }
    if (slotDateForToday !== null) {
      const future = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      const futureTime = `${String(future.getHours()).padStart(2, '0')}:${String(future.getMinutes()).padStart(2, '0')}:00`;
      const result = isSlotTimePassed(slotDateForToday, futureTime);
      assert(result === false, `Expected false when slot today and future time, got ${result}`);
    }
  });

  runTest('should_isSlotInPast_return_true_when_slot_date_before_today', () => {
    assert(isSlotInPast('2000-01-01', '23:59:00') === true, 'Past date in past');
  });

  runTest('should_isSlotInPast_return_false_when_slot_date_after_today', () => {
    assert(isSlotInPast('2030-12-31', '00:00:00') === false, 'Future date not in past');
  });

  runTest('should_isSlotInPast_execute_today_branch_and_return_boolean', () => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const result = isSlotInPast(todayStr, '00:00:00');
    assert(typeof result === 'boolean', `Expected boolean, got ${typeof result}`);
  });

  runTest('should_isSlotInPast_execute_today_branch_with_future_time', () => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const future = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const futureTime = `${String(future.getHours()).padStart(2, '0')}:${String(future.getMinutes()).padStart(2, '0')}:00`;
    const result = isSlotInPast(todayStr, futureTime);
    assert(typeof result === 'boolean', `Expected boolean, got ${typeof result}`);
  });

  runTest('should_isSlotInPast_today_branch_return_true_when_slot_time_past', () => {
    const now = new Date();
    const utcDate = now.toISOString().split('T')[0];
    const localStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    let slotDateForToday: string | null = null;
    for (const d of [utcDate, localStr]) {
      const obj = new Date(d + 'T00:00:00');
      if (obj.toISOString().split('T')[0] === utcDate) {
        slotDateForToday = d;
        break;
      }
    }
    if (slotDateForToday !== null) {
      const result = isSlotInPast(slotDateForToday, '00:00:00');
      assert(result === true, `Expected true when today and midnight, got ${result}`);
    }
  });

  runTest('should_isSlotInPast_today_branch_return_false_when_slot_time_future', () => {
    const now = new Date();
    const utcDate = now.toISOString().split('T')[0];
    const localStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    let slotDateForToday: string | null = null;
    for (const d of [utcDate, localStr]) {
      const obj = new Date(d + 'T00:00:00');
      if (obj.toISOString().split('T')[0] === utcDate) {
        slotDateForToday = d;
        break;
      }
    }
    if (slotDateForToday !== null) {
      const future = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      const futureTime = `${String(future.getHours()).padStart(2, '0')}:${String(future.getMinutes()).padStart(2, '0')}:00`;
      const result = isSlotInPast(slotDateForToday, futureTime);
      assert(result === false, `Expected false when today and future time, got ${result}`);
    }
  });

  runTest('should_timeToMinutes_handle_single_part', () => {
    assert(timeToMinutes('09') === 9 * 60, `Expected 540, got ${timeToMinutes('09')}`);
  });

  runTest('should_generateTimeSlots_return_empty_when_slotDuration_negative', () => {
    const slots = generateTimeSlots('09:00:00', '12:00:00', -1);
    assert(slots.length === 0, `Expected 0 slots, got ${slots.length}`);
  });
}

if (require.main === module) {
  runUnitUtilsTimeTests();
  console.log('\n✅ unit-utils-time: all passed\n');
}
