#!/usr/bin/env ts-node
import {
  supabase,
  TestRunner,
  getRandomBusiness,
  getRandomAvailableSlot,
  cleanupTestData,
  simulateUserAction,
} from './test-utils';
async function testErrorScenarios() {
  const runner = new TestRunner();
  const cleanup: { bookings: string[]; slots: string[] } = {
    bookings: [],
    slots: [],
  };
  try {
    await runner.runTest('STEP 1: Try to book suspended business', async () => {
      const business = await getRandomBusiness();

      // First, ensure we have a slot (might need to generate)
      let slot;
      try {
        slot = await getRandomAvailableSlot(business.id);
      } catch (error) {
        // If no slots, skip this test
        console.log(`   ⚠️  No slots available, skipping suspended business test`);
        return;
      }
      await supabase
        .from('businesses')
        .update({ suspended: true, suspended_at: new Date().toISOString() })
        .eq('id', business.id);
      await simulateUserAction('User tries to book suspended business');
      const bookingId = `ERROR-${Date.now()}`;
      const { data, error } = await supabase.rpc('create_booking_atomically', {
        p_business_id: business.id,
        p_slot_id: slot.id,
        p_customer_name: 'Test Customer',
        p_customer_phone: '+919876543210',
        p_booking_id: bookingId,
        p_customer_user_id: null,
        p_total_duration_minutes: 30,
        p_total_price_cents: 1000,
        p_services_count: 1,
        p_service_data: null,
      });
      if (data?.success) {
        cleanup.bookings.push(data.booking_id);
        cleanup.slots.push(slot.id);
        throw new Error('Booking should have failed for suspended business');
      }
      if (data?.error?.includes('suspended')) {
        console.log(`   ✅ Error handling verified`);
        console.log(`   🚫 Booking correctly rejected: ${data.error}`);
        console.log(`   🔒 Suspension check working as expected`);
      } else {
        throw new Error(`Expected suspension error, got: ${data?.error || error?.message}`);
      }
      await supabase
        .from('businesses')
        .update({ suspended: false, suspended_at: null })
        .eq('id', business.id);
    });
  } finally {
    await cleanupTestData(cleanup.bookings, cleanup.slots);
  }
  runner.printSummary();
  return runner.getResults();
}
if (require.main === module) {
  testErrorScenarios()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}
export { testErrorScenarios };
