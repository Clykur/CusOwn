#!/usr/bin/env ts-node

/**
 * USER JOURNEY TEST: Owner Flow
 * Simulates a complete owner journey from setup to managing bookings
 */

import {
  supabase,
  TestRunner,
  getOrCreateTestUser,
  cleanupTestData,
  simulateUserAction,
} from './test-utils';

async function testOwnerJourney() {
  const runner = new TestRunner();
  const cleanup: { bookings: string[]; slots: string[]; businesses: string[] } = {
    bookings: [],
    slots: [],
    businesses: [],
  };
  let owner: any = null;
  let testBusiness: any = null;

  try {
    await runner.runTest('STEP 1: Owner logs in', async () => {
      owner = await getOrCreateTestUser(`test-owner-${Date.now()}@test.com`, 'owner');
      await simulateUserAction('Owner logs in', { email: owner.email });
      console.log(`   Owner ID: ${owner.id.substring(0, 8)}...`);
    });

    await runner.runTest('STEP 2: Owner views dashboard (no business)', async () => {
      await simulateUserAction('Owner views dashboard');
      const { data: businesses } = await supabase
        .from('businesses')
        .select('*')
        .eq('owner_user_id', owner.id);
      console.log(`   Owner has ${businesses?.length || 0} businesses`);
    });

    await runner.runTest('STEP 3: Owner creates business', async () => {
      await simulateUserAction('Owner creates business');
      const timestamp = Date.now();
      const businessName = `Test Salon ${timestamp}`;
      const bookingLink = `test-salon-${timestamp}`;
      const uniqueWhatsapp = `+9198765${String(timestamp).slice(-6)}`;

      const { data, error } = await supabase
        .from('businesses')
        .insert({
          salon_name: businessName,
          owner_name: 'Test Owner',
          whatsapp_number: uniqueWhatsapp,
          opening_time: '09:00',
          closing_time: '18:00',
          slot_duration: 30,
          booking_link: bookingLink,
          address: '123 Test Street',
          location: 'Test City',
          owner_user_id: owner.id,
        })
        .select()
        .single();

      if (error || !data) throw new Error(`Failed to create business: ${error?.message}`);
      testBusiness = data;
      cleanup.businesses.push(data.id);

      console.log(`   ✅ Business created: ${data.salon_name}`);
      console.log(`   📍 Location: ${data.location}`);
      console.log(`   🔗 Booking Link: ${data.booking_link}`);
      console.log(`   📱 WhatsApp: ${data.whatsapp_number}`);
      console.log(`   ⏰ Hours: ${data.opening_time} - ${data.closing_time}`);
      console.log(`   ⏱️  Slot Duration: ${data.slot_duration} minutes`);
    });

    await runner.runTest('STEP 4: Owner views their business', async () => {
      await simulateUserAction('Owner views their business');
      const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('owner_user_id', owner.id)
        .single();
      if (error || !data) throw new Error('Failed to fetch owner business');
      console.log(`   Business: ${data.salon_name}`);
    });

    await runner.runTest('STEP 5: Owner views bookings', async () => {
      await simulateUserAction('Owner views bookings');
      const { data, error } = await supabase
        .from('bookings')
        .select('*, slot:slot_id(date, start_time, end_time)')
        .eq('business_id', testBusiness.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw new Error(`Failed to fetch bookings: ${error.message}`);

      const bookings = data || [];
      const statusCounts = {
        pending: bookings.filter((b) => b.status === 'pending').length,
        confirmed: bookings.filter((b) => b.status === 'confirmed').length,
        cancelled: bookings.filter((b) => b.status === 'cancelled').length,
        rejected: bookings.filter((b) => b.status === 'rejected').length,
      };

      console.log(`   📊 Bookings Summary:`);
      console.log(`      Total: ${bookings.length}`);
      console.log(`      Pending: ${statusCounts.pending}`);
      console.log(`      Confirmed: ${statusCounts.confirmed}`);
      console.log(`      Cancelled: ${statusCounts.cancelled}`);
      console.log(`      Rejected: ${statusCounts.rejected}`);
    });
  } finally {
    if (cleanup.businesses.length > 0) {
      await supabase.from('businesses').delete().in('id', cleanup.businesses);
    }
    await cleanupTestData(cleanup.bookings, cleanup.slots);
  }

  runner.printSummary();
  return runner.getResults();
}

if (require.main === module) {
  testOwnerJourney()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

export { testOwnerJourney };
