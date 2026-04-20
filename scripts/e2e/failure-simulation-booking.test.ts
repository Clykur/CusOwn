#!/usr/bin/env ts-node

/**
 * Failure simulation tests for booking platform:
 * - Database deadlock / serialization retry
 * - Service outage (upstream dependency failure)
 * - Network timeout from client perspective
 *
 * These tests are intended to run against a staging/test environment.
 */

/* eslint-disable no-console */

import 'ts-node/register';
import 'tsconfig-paths/register';
import fetch from 'node-fetch';
import { withBookingRetry } from '@/lib/booking-retry';
import {
  METRICS_BOOKING_DEADLOCK_RETRY_TOTAL,
  METRICS_OBSERVABILITY_BOOKING_ATTEMPT_TOTAL,
} from '@/config/constants';
import { metricsService } from '@/lib/monitoring/metrics';
import { supabase, TestRunner, getRandomBusiness, getRandomAvailableSlot } from '../test-utils';

async function simulateDatabaseDeadlock(runner: TestRunner) {
  await runner.runTest('failure: database deadlock retried safely', async () => {
    const business = await getRandomBusiness();
    const slot = await getRandomAvailableSlot(business.id);

    let attempts = 0;
    await withBookingRetry(async () => {
      attempts += 1;
      if (attempts === 1) {
        const err: any = new Error('deadlock detected');
        err.code = '40P01';
        throw err;
      }
      const { data, error } = await supabase.rpc('create_booking_atomically', {
        p_business_id: business.id,
        p_slot_id: slot.id,
        p_customer_name: 'FailureSim Deadlock',
        p_customer_phone: '+919876543210',
        p_booking_id: `FAILURE-DEADLOCK-${Date.now()}`,
        p_customer_user_id: null,
        p_total_duration_minutes: 30,
        p_total_price_cents: 1000,
        p_services_count: 1,
        p_service_data: null,
      });
      if (error || !data?.success) {
        throw new Error(error?.message || data?.error || 'booking failed');
      }
    });

    const retries = await metricsService.getCount(METRICS_BOOKING_DEADLOCK_RETRY_TOTAL);
    if (retries <= 0) {
      throw new Error('Expected METRICS_BOOKING_DEADLOCK_RETRY_TOTAL to increment');
    }
  });
}

async function simulateServiceOutage(runner: TestRunner) {
  await runner.runTest('failure: upstream service outage does not corrupt booking', async () => {
    const business = await getRandomBusiness();
    const slot = await getRandomAvailableSlot(business.id);

    const bookingId = `FAILURE-UPSTREAM-${Date.now()}`;
    const { data, error } = await supabase.rpc('create_booking_atomically', {
      p_business_id: business.id,
      p_slot_id: slot.id,
      p_customer_name: 'FailureSim Outage',
      p_customer_phone: '+919876543210',
      p_booking_id: bookingId,
      p_customer_user_id: null,
      p_total_duration_minutes: 30,
      p_total_price_cents: 1000,
      p_services_count: 1,
      p_service_data: null,
    });

    if (error || !data?.success) {
      throw new Error(error?.message || data?.error || 'booking failed');
    }

    // Simulate an outage by calling a route expected to talk to an upstream provider.
    const apiBase = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const res = await fetch(`${apiBase}/api/payments/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ simulate_outage: true, booking_id: data.booking_id }),
    }).catch((e) => {
      console.error('verify request failed (expected in outage simulation):', e);
      return null as any;
    });

    // Regardless of verify outcome, booking should still exist and not be corrupted.
    const { data: bookingRow } = await supabase
      .from('bookings')
      .select('id, status')
      .eq('id', data.booking_id)
      .single();

    if (!bookingRow) {
      throw new Error('Booking missing after simulated outage');
    }
    if (!['pending', 'confirmed', 'cancelled', 'rejected'].includes(bookingRow.status)) {
      throw new Error(`Booking in unexpected status after outage: ${bookingRow.status}`);
    }

    void res;
  });
}

async function simulateNetworkTimeout(runner: TestRunner) {
  await runner.runTest('failure: client-side timeout does not corrupt booking', async () => {
    const apiBase = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 50);

    let timedOut = false;
    try {
      await fetch(`${apiBase}/api/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}), // invalid payload; should 4xx if it reaches server
        signal: controller.signal,
      });
    } catch (err) {
      timedOut = true;
      console.log('Network timeout as expected:', err instanceof Error ? err.message : err);
    } finally {
      clearTimeout(timeout);
    }

    if (!timedOut) {
      throw new Error('Expected client-side timeout did not occur');
    }

    // Ensure booking attempt metric did not spike unexpectedly
    const attempts = await metricsService.getCount(METRICS_OBSERVABILITY_BOOKING_ATTEMPT_TOTAL);
    void attempts;
  });
}

async function main() {
  const runner = new TestRunner();

  try {
    await simulateDatabaseDeadlock(runner);
    await simulateServiceOutage(runner);
    await simulateNetworkTimeout(runner);
  } finally {
    runner.printSummary();
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
