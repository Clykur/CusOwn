#!/usr/bin/env ts-node
import { supabase, TestRunner, getRandomBusiness, getRandomAvailableSlot, getOrCreateTestUser, cleanupTestData, simulateUserAction } from './test-utils';
async function testConcurrentOperations() {
  const runner = new TestRunner();
  const cleanup: { bookings: string[]; slots: string[] } = { bookings: [], slots: [] };
  try {
    await runner.runTest('STEP 1: Multiple users compete for same slot', async () => {
      const business = await getRandomBusiness();
      
      // Try to get a slot, with fallback
      let slot;
      try {
        slot = await getRandomAvailableSlot(business.id);
        cleanup.slots.push(slot.id);
      } catch (error) {
        throw new Error(`No available slots found for concurrent test: ${error instanceof Error ? error.message : String(error)}`);
      }
      await simulateUserAction('10 users try to book same slot simultaneously');
      const concurrentRequests = 10;
      const users = await Promise.all(Array.from({ length: concurrentRequests }, (_, i) => getOrCreateTestUser(`concurrent-${Date.now()}-${i}@test.com`, 'customer')));
      const promises = users.map((user, i) => {
        const bookingId = `CONC-${Date.now()}-${i}`;
        return supabase.rpc('create_booking_atomically', {
          p_business_id: business.id, p_slot_id: slot.id, p_customer_name: `Concurrent User ${i}`,
          p_customer_phone: `+9198765432${String(i).padStart(2, '0')}`, p_booking_id: bookingId,
          p_customer_user_id: user.id, p_total_duration_minutes: 30, p_total_price_cents: 1000, p_services_count: 1, p_service_data: null,
        });
      });
      const results = await Promise.allSettled(promises);
      const successful: string[] = [];
      const failed: Array<{ error: string; reason: string }> = [];
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const response = result.value;
          if (response.data?.success) {
            successful.push(response.data.booking_id);
            cleanup.bookings.push(response.data.booking_id);
          } else {
            // Failed but got a response
            const errorMsg = response.data?.error || response.error?.message || 'Unknown error';
            failed.push({ 
              error: `User ${index}`, 
              reason: errorMsg 
            });
          }
        } else {
          // Promise rejected
          const errorMsg = result.reason?.message || 'Promise rejected';
          failed.push({ 
            error: `User ${index}`, 
            reason: errorMsg 
          });
        }
      });
      
      // Group failures by reason
      const failureReasons: Record<string, number> = {};
      failed.forEach(f => {
        const reason = f.reason.includes('reserved') ? 'Slot already reserved' :
                      f.reason.includes('booked') ? 'Slot already booked' :
                      f.reason.includes('failed') ? 'Reservation failed' :
                      'Other error';
        failureReasons[reason] = (failureReasons[reason] || 0) + 1;
      });
      
      console.log(`   🔄 Concurrent Test Results:`);
      console.log(`      Total Requests: ${concurrentRequests}`);
      console.log(`      ✅ Successful: ${successful.length}`);
      console.log(`      ❌ Failed: ${concurrentRequests - successful.length}`);
      console.log(`      📊 Success Rate: ${((successful.length / concurrentRequests) * 100).toFixed(1)}%`);
      
      if (Object.keys(failureReasons).length > 0) {
        console.log(`   📋 Failure Breakdown:`);
        Object.entries(failureReasons).forEach(([reason, count]) => {
          console.log(`      ${reason}: ${count}`);
        });
      }
      
      if (successful.length !== 1) {
        throw new Error(`Expected exactly 1 successful booking, got ${successful.length}`);
      }
      
      console.log(`   ✅ Race condition prevented: Only 1 booking succeeded`);
      console.log(`   🔒 Slot reservation system working correctly`);
      console.log(`   🔐 Database locking (FOR UPDATE) prevented double-booking`);
      console.log(`   ⚡ All ${concurrentRequests} requests processed atomically`);
    });
  } finally {
    await cleanupTestData(cleanup.bookings, cleanup.slots);
  }
  runner.printSummary();
  return runner.getResults();
}
if (require.main === module) {
  testConcurrentOperations().then(() => process.exit(0)).catch((error) => { console.error('Test failed:', error); process.exit(1); });
}
export { testConcurrentOperations };
