#!/usr/bin/env ts-node
/**
 * Unit tests: config/constants
 * WHATSAPP_MESSAGE_TEMPLATES and other exported constants (coverage).
 */

import {
  WHATSAPP_MESSAGE_TEMPLATES,
  BOOKING_LINK_PREFIX,
  API_ROUTES,
  ROUTES,
  VALIDATION,
  ERROR_MESSAGES,
  SLOT_DURATIONS,
  BOOKING_STATUS,
  DEFAULT_SLOT_DURATION,
} from '../config/constants';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function runTest(name: string, fn: () => void): void {
  fn();
  console.log(`  ✅ ${name}`);
}

export function runUnitConfigConstantsTests(): void {
  console.log('\n--- unit: config/constants ---\n');

  runTest('should_WHATSAPP_MESSAGE_TEMPLATES_BOOKING_REQUEST_return_string', () => {
    const msg = WHATSAPP_MESSAGE_TEMPLATES.BOOKING_REQUEST(
      'Customer',
      '2025-01-15',
      '10:00',
      'bid-123'
    );
    assert(typeof msg === 'string', 'Expected string');
    assert(
      msg.includes('Customer') &&
        msg.includes('2025-01-15') &&
        msg.includes('10:00') &&
        msg.includes('bid-123'),
      'Expected all params'
    );
  });

  runTest('should_WHATSAPP_MESSAGE_TEMPLATES_CONFIRMATION_return_string', () => {
    const msg = WHATSAPP_MESSAGE_TEMPLATES.CONFIRMATION(
      'Customer',
      '2025-01-15',
      '10:00',
      'Salon Name',
      '123 Street',
      'https://maps.link'
    );
    assert(typeof msg === 'string', 'Expected string');
    assert(
      msg.includes('Salon Name') && msg.includes('123 Street') && msg.includes('maps.link'),
      'Expected all params'
    );
  });

  runTest('should_WHATSAPP_MESSAGE_TEMPLATES_REJECTION_return_string', () => {
    const msg = WHATSAPP_MESSAGE_TEMPLATES.REJECTION('Customer', 'https://book.link');
    assert(typeof msg === 'string', 'Expected string');
    assert(msg.includes('Customer') && msg.includes('book.link'), 'Expected params');
  });

  runTest('should_constants_export_values', () => {
    assert(BOOKING_LINK_PREFIX === '/b/', 'BOOKING_LINK_PREFIX');
    assert(API_ROUTES.SALONS === '/api/salons', 'API_ROUTES.SALONS');
    assert(ROUTES.HOME === '/', 'ROUTES.HOME');
    assert(VALIDATION.SALON_NAME_MIN_LENGTH === 2, 'VALIDATION');
    assert(typeof ERROR_MESSAGES.SALON_NAME_REQUIRED === 'string', 'ERROR_MESSAGES');
    assert(SLOT_DURATIONS.includes(30), 'SLOT_DURATIONS');
    assert(BOOKING_STATUS.PENDING === 'pending', 'BOOKING_STATUS');
    assert(DEFAULT_SLOT_DURATION === 30, 'DEFAULT_SLOT_DURATION');
  });
}

if (require.main === module) {
  runUnitConfigConstantsTests();
  console.log('\n✅ unit-config-constants: all passed\n');
}
