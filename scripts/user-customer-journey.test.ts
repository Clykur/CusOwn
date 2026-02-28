#!/usr/bin/env ts-node

/**
 * USER JOURNEY TEST: Customer Flow
 * Simulates a complete customer journey from browsing to booking
 */

import {
  supabase,
  TestRunner,
  getRandomBusiness,
  getRandomAvailableSlot,
  getOrCreateTestUser,
  cleanupTestData,
  simulateUserAction,
} from './test-utils';

async function testCustomerJourney() {
  const runner = new TestRunner();
  const cleanup: { bookings: string[]; slots: string[] } = {
    bookings: [],
    slots: [],
  };
  let customer: any = null;

  try {
    // STEP 1: User logs in as customer
    await runner.runTest('STEP 1: Customer logs in', async () => {
      customer = await getOrCreateTestUser(`test-customer-${Date.now()}@test.com`, 'customer');
      await simulateUserAction('Customer logs in', { email: customer.email });
      console.log(`   Customer ID: ${customer.id.substring(0, 8)}...`);
    });

    // STEP 2: Browse businesses
    await runner.runTest('STEP 2: Browse available businesses', async () => {
      await simulateUserAction('Customer browses businesses');
      const { data, error } = await supabase
        .from('businesses')
        .select('id, salon_name, location, category')
        .eq('suspended', false)
        .limit(10);

      if (error) {
        throw new Error(`Failed to fetch businesses: ${error.message}`);
      }

      if (!data || data.length === 0) {
        throw new Error('No businesses found');
      }

      console.log(`   Found ${data.length} businesses`);
      (global as any).testBusinesses = data;
    });

    // STEP 3: View business details
    await runner.runTest('STEP 3: View business details', async () => {
      const business = await getRandomBusiness();
      await simulateUserAction('Customer views business details', {
        businessName: business.salon_name,
      });

      const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', business.id)
        .eq('suspended', false)
        .single();

      if (error || !data) {
        throw new Error('Business not found or suspended');
      }

      console.log(`   Business: ${data.salon_name}`);
      console.log(`   Location: ${data.location || 'N/A'}`);
      (global as any).selectedBusiness = data;
    });

    // STEP 4: View available slots
    await runner.runTest('STEP 4: View available slots', async () => {
      const business = (global as any).selectedBusiness;
      await simulateUserAction('Customer views available slots');

      // Use getRandomAvailableSlot which auto-generates slots if needed
      // This will find or create slots using BFS approach
      try {
        const slot = await getRandomAvailableSlot(business.id);
        console.log(`   Found available slot: ${slot.date} ${slot.start_time} - ${slot.end_time}`);
        (global as any).selectedSlot = slot;
        (global as any).availableSlots = [slot];
      } catch (error) {
        // If still no slots, try to query what we have
        const dates: string[] = [];
        for (let i = 1; i <= 7; i++) {
          const date = new Date();
          date.setDate(date.getDate() + i);
          dates.push(date.toISOString().split('T')[0]);
        }

        let slotsFound = false;
        for (const dateStr of dates) {
          const { data, error: queryError } = await supabase
            .from('slots')
            .select('*')
            .eq('business_id', business.id)
            .eq('status', 'available')
            .eq('date', dateStr)
            .order('start_time', { ascending: true })
            .limit(10);

          if (!queryError && data && data.length > 0) {
            console.log(`   Found ${data.length} available slots for ${dateStr}`);
            slotsFound = true;
            (global as any).availableSlots = data;
            (global as any).selectedSlot = data[0];
            break;
          }
        }

        if (!slotsFound) {
          throw new Error(
            `No available slots found: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    });

    // STEP 5: Create booking
    await runner.runTest('STEP 5: Customer creates booking', async () => {
      const business = (global as any).selectedBusiness;
      const slot = (global as any).selectedSlot || (await getRandomAvailableSlot(business.id));
      await simulateUserAction('Customer creates booking', {
        slotTime: slot.start_time,
      });

      const bookingId = `CUST-${Date.now()}`;
      const { data, error } = await supabase.rpc('create_booking_atomically', {
        p_business_id: business.id,
        p_slot_id: slot.id,
        p_customer_name: 'Test Customer',
        p_customer_phone: '+919876543210',
        p_booking_id: bookingId,
        p_customer_user_id: customer.id,
        p_total_duration_minutes: 30,
        p_total_price_cents: 1000,
        p_services_count: 1,
        p_service_data: null,
      });

      if (error || !data?.success) {
        throw new Error(error?.message || data?.error || 'Booking creation failed');
      }

      cleanup.bookings.push(data.booking_id);
      cleanup.slots.push(slot.id);
      (global as any).customerBookingId = data.booking_id;

      console.log(`   ✅ Booking created successfully`);
      console.log(`   📋 Booking ID: ${bookingId}`);
      console.log(`   🏢 Business: ${business.salon_name}`);
      console.log(`   📅 Date: ${slot.date}`);
      console.log(`   ⏰ Time: ${slot.start_time} - ${slot.end_time}`);
      console.log(`   💰 Price: ₹${(1000 / 100).toFixed(2)}`);
      console.log(`   ⏱️  Duration: 30 minutes`);
    });

    // STEP 6: View my bookings
    await runner.runTest('STEP 6: Customer views their bookings', async () => {
      await simulateUserAction('Customer views their bookings');

      const { data, error } = await supabase
        .from('bookings')
        .select(
          '*, business:business_id(salon_name, location), slot:slot_id(date, start_time, end_time)'
        )
        .eq('customer_user_id', customer.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch bookings: ${error.message}`);
      }

      const myBooking = data?.find((b) => b.id === (global as any).customerBookingId);
      if (!myBooking) {
        throw new Error('Created booking not found in customer bookings');
      }

      const bookings = data || [];
      const statusCounts = {
        pending: bookings.filter((b) => b.status === 'pending').length,
        confirmed: bookings.filter((b) => b.status === 'confirmed').length,
        cancelled: bookings.filter((b) => b.status === 'cancelled').length,
      };

      console.log(`   📊 Bookings Overview:`);
      console.log(`      Total Bookings: ${bookings.length}`);
      console.log(`      Pending: ${statusCounts.pending}`);
      console.log(`      Confirmed: ${statusCounts.confirmed}`);
      console.log(`      Cancelled: ${statusCounts.cancelled}`);

      if (myBooking) {
        console.log(`   📋 Latest Booking:`);
        console.log(`      ID: ${myBooking.booking_id}`);
        console.log(`      Business: ${myBooking.business?.salon_name || 'N/A'}`);
        console.log(`      Status: ${myBooking.status}`);
        console.log(`      Date: ${myBooking.slot?.date || 'N/A'}`);
        console.log(`      Time: ${myBooking.slot?.start_time || 'N/A'}`);
      }
    });

    // STEP 7: Check booking status
    await runner.runTest('STEP 7: Customer checks booking status', async () => {
      const bookingId = (global as any).customerBookingId;
      await simulateUserAction('Customer checks booking status');

      const { data, error } = await supabase
        .from('bookings')
        .select('*, business:business_id(salon_name), slot:slot_id(date, start_time, end_time)')
        .eq('id', bookingId)
        .single();

      if (error || !data) {
        throw new Error('Failed to fetch booking');
      }

      console.log(`   📋 Booking Details:`);
      console.log(`      Booking ID: ${data.booking_id}`);
      console.log(`      Status: ${data.status.toUpperCase()}`);
      console.log(`      Customer: ${data.customer_name}`);
      console.log(`      Phone: ${data.customer_phone}`);
      console.log(`      Business: ${data.business?.salon_name || 'N/A'}`);
      console.log(`      Date: ${data.slot?.date || 'N/A'}`);
      console.log(
        `      Time: ${data.slot?.start_time || 'N/A'} - ${data.slot?.end_time || 'N/A'}`
      );
      console.log(`      Created: ${new Date(data.created_at).toLocaleString()}`);
    });
  } finally {
    await cleanupTestData(cleanup.bookings, cleanup.slots);
  }

  runner.printSummary();
  return runner.getResults();
}

if (require.main === module) {
  testCustomerJourney()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

export { testCustomerJourney };
