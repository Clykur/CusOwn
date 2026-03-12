#!/usr/bin/env ts-node
/**
 * Unit tests: lib/utils/navigation (pure parts only)
 * ROUTES constants, getAdminDashboardUrl, getOwnerDashboardUrl. No window/fetch.
 */

import { ROUTES, getAdminDashboardUrl, getOwnerDashboardUrl } from '../../lib/utils/navigation';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function runTest(name: string, fn: () => void): void {
  fn();
  console.log(`  ✅ ${name}`);
}

export function runUnitNavigationTests(): void {
  console.log('\n--- unit: lib/utils/navigation (pure) ---\n');

  runTest('ROUTES.HOME is root', () => {
    assert(ROUTES.HOME === '/', `Expected '/', got '${ROUTES.HOME}'`);
  });

  runTest('ROUTES.BOOKING returns path with bookingLink', () => {
    const out = ROUTES.BOOKING('my-salon');
    assert(out === '/book/my-salon', `Expected '/book/my-salon', got '${out}'`);
  });

  runTest('ROUTES.BOOKING_STATUS returns path with bookingId', () => {
    const out = ROUTES.BOOKING_STATUS('bid-123');
    assert(out === '/booking/bid-123', `Expected '/booking/bid-123', got '${out}'`);
  });

  runTest('ROUTES.ACCEPT returns path with bookingId', () => {
    const out = ROUTES.ACCEPT('bid-1');
    assert(out === '/accept/bid-1', `Expected '/accept/bid-1', got '${out}'`);
  });

  runTest('ROUTES.AUTH_LOGIN returns login path without redirect', () => {
    const out = ROUTES.AUTH_LOGIN();
    assert(out.includes('/auth/login'), `Expected login path, got '${out}'`);
    assert(!out.includes('redirect_to'), `Expected no redirect_to when no arg`);
  });

  runTest('ROUTES.AUTH_LOGIN appends redirect_to when provided', () => {
    const out = ROUTES.AUTH_LOGIN('/dashboard');
    assert(out.includes('redirect_to='), `Expected redirect_to param, got '${out}'`);
  });

  runTest('getAdminDashboardUrl returns base when no tab', () => {
    const out = getAdminDashboardUrl();
    assert(out === '/admin/dashboard', `Expected base, got '${out}'`);
  });

  runTest('getAdminDashboardUrl appends tab query when provided', () => {
    const out = getAdminDashboardUrl('users');
    assert(out === '/admin/dashboard?tab=users', `Expected tab param, got '${out}'`);
  });

  runTest('getAdminDashboardUrl appends page when > 1', () => {
    const out = getAdminDashboardUrl(undefined, 2);
    assert(out.includes('page=2'), `Expected page=2, got '${out}'`);
  });

  runTest('getOwnerDashboardUrl returns owner path when bookingLink provided', () => {
    const out = getOwnerDashboardUrl('my-salon');
    assert(out === '/owner/my-salon', `Expected '/owner/my-salon', got '${out}'`);
  });

  runTest('getOwnerDashboardUrl returns dashboard when no bookingLink', () => {
    const out = getOwnerDashboardUrl();
    assert(out === '/owner/dashboard', `Expected '/owner/dashboard', got '${out}'`);
  });
}

if (require.main === module) {
  runUnitNavigationTests();
  console.log('\n✅ unit-navigation: all passed\n');
}
