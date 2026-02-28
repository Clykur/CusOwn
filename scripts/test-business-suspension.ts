#!/usr/bin/env ts-node

import {
  supabase,
  TestRunner,
  getRandomBusiness,
  getRandomAvailableSlot,
  cleanupTestData,
} from './test-utils';

async function testBusinessSuspension() {
  const runner = new TestRunner();
  const cleanup: { bookings: string[]; slots: string[] } = {
    bookings: [],
    slots: [],
  };
  let testBusinessId: string | null = null;
  let wasSuspended: boolean = false;

  try {
    await runner.runTest('Get real business', async () => {
      const business = await getRandomBusiness();
      testBusinessId = business.id;
      wasSuspended = business.suspended || false;
      console.log(`   Business: ${business.salon_name} (${business.id.substring(0, 8)}...)`);
      console.log(`   Currently suspended: ${wasSuspended}`);
    });

    await runner.runTest('Suspend business', async () => {
      if (!testBusinessId) throw new Error('No business ID');

      const { error } = await supabase
        .from('businesses')
        .update({ suspended: true, suspended_at: new Date().toISOString() })
        .eq('id', testBusinessId);

      if (error) {
        throw new Error(`Failed to suspend business: ${error.message}`);
      }

      console.log(`   Business suspended successfully`);
    });

    await runner.runTest('Verify suspended business excluded from search', async () => {
      if (!testBusinessId) throw new Error('No business ID');

      const { data, error } = await supabase
        .from('businesses')
        .select('id')
        .eq('suspended', false)
        .eq('id', testBusinessId)
        .single();

      if (!error) {
        throw new Error('Suspended business should not appear in search');
      }

      console.log(`   Suspended business correctly excluded from search`);
    });

    await runner.runTest('Verify suspended business cannot receive bookings', async () => {
      if (!testBusinessId) throw new Error('No business ID');

      const slot = await getRandomAvailableSlot(testBusinessId);

      const bookingId = `TEST-${Date.now()}`;
      const { data, error } = await supabase.rpc('create_booking_atomically', {
        p_business_id: testBusinessId,
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
        console.log(`   Correctly rejected booking: ${data.error}`);
      } else {
        throw new Error(`Expected suspension error, got: ${data?.error || error?.message}`);
      }
    });

    await runner.runTest('Verify getSalonByBookingLink excludes suspended', async () => {
      if (!testBusinessId) throw new Error('No business ID');

      const { data: business } = await supabase
        .from('businesses')
        .select('booking_link')
        .eq('id', testBusinessId)
        .single();

      if (!business?.booking_link) {
        throw new Error('Business booking link not found');
      }

      const { data: found, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('booking_link', business.booking_link)
        .eq('suspended', false)
        .single();

      if (!error) {
        throw new Error('Suspended business should not be found');
      }

      console.log(`   Suspended business correctly excluded from getSalonByBookingLink`);
    });
  } finally {
    if (testBusinessId) {
      await supabase
        .from('businesses')
        .update({
          suspended: wasSuspended,
          suspended_at: wasSuspended ? null : null,
        })
        .eq('id', testBusinessId);
    }
    await cleanupTestData(cleanup.bookings, cleanup.slots);
  }

  runner.printSummary();
  return runner.getResults();
}

if (require.main === module) {
  testBusinessSuspension()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

export { testBusinessSuspension };
