#!/usr/bin/env ts-node

/**
 * PHASE 6: ABUSE & RATE LIMITING TESTS
 */

import { supabase, TestRunner, getRandomBusiness, getRandomAvailableSlot, cleanupTestData, simulateUserAction } from './test-utils';

async function testAbuseRateLimiting() {
  const runner = new TestRunner();
  const cleanup: { bookings: string[]; slots: string[] } = {
    bookings: [],
    slots: [],
  };

  try {
    await runner.runTest('ABUSE 1: Slot hoarding detection', async () => {
      const business = await getRandomBusiness();
      await simulateUserAction('Simulate slot hoarding');
      
      const slots: string[] = [];
      for (let i = 0; i < 3; i++) {
        const slot = await getRandomAvailableSlot(business.id);
        if (slot && !slots.includes(slot.id)) {
          slots.push(slot.id);
          cleanup.slots.push(slot.id);
        }
      }
      
      console.log(`   ✅ Reserved ${slots.length} slots`);
    });

    await runner.runTest('ABUSE 2: Concurrent reservation attempts', async () => {
      const business = await getRandomBusiness();
      const slot = await getRandomAvailableSlot(business.id);
      cleanup.slots.push(slot.id);
      
      await simulateUserAction('Simulate concurrent reservation abuse');
      
      const attempts = Array.from({ length: 5 }, (_, i) => 
        supabase.rpc('create_booking_atomically', {
          p_business_id: business.id,
          p_slot_id: slot.id,
          p_customer_name: `User ${i}`,
          p_customer_phone: `+9198765432${String(i).padStart(2, '0')}`,
          p_booking_id: `TEST-${Date.now()}-${i}`,
          p_customer_user_id: null,
          p_total_duration_minutes: 30,
          p_total_price_cents: 1000,
          p_services_count: 1,
          p_service_data: null,
        })
      );
      
      const results = await Promise.all(attempts);
      const successful = results.filter(r => r.data?.success).length;
      
      if (successful > 1) {
        throw new Error(`Multiple bookings succeeded: ${successful}`);
      }
      
      const successResult = results.find(r => r.data?.success);
      if (successResult?.data?.booking_id) {
        cleanup.bookings.push(successResult.data.booking_id);
      }
      
      console.log(`   ✅ Concurrent attempts: ${successful} succeeded`);
    });

  } finally {
    await cleanupTestData(cleanup.bookings, cleanup.slots);
  }

  runner.printSummary();
  return runner.getResults();
}

if (require.main === module) {
  testAbuseRateLimiting()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

export { testAbuseRateLimiting };
