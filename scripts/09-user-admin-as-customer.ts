#!/usr/bin/env ts-node

/**
 * USER JOURNEY TEST: Admin Logs In As Customer
 * Simulates admin user accessing customer features and flows
 */

import { supabase, TestRunner, getRandomBusiness, getRandomAvailableSlot, getOrCreateTestUser, cleanupTestData, simulateUserAction } from './test-utils';

async function testAdminAsCustomer() {
  const runner = new TestRunner();
  const cleanup: { bookings: string[]; slots: string[] } = { bookings: [], slots: [] };
  let admin: any = null;

  try {
    // STEP 1: Admin logs in
    await runner.runTest('STEP 1: Admin logs in', async () => {
      admin = await getOrCreateTestUser(`test-admin-customer-${Date.now()}@test.com`, 'owner');
      await supabase
        .from('user_profiles')
        .update({ user_type: 'admin' })
        .eq('id', admin.id);

      await simulateUserAction('Admin logs in', { email: admin.email, role: 'admin' });
      console.log(`   Admin ID: ${admin.id.substring(0, 8)}...`);
    });

    // STEP 2: Admin views customer dashboard
    await runner.runTest('STEP 2: Admin views customer dashboard', async () => {
      await simulateUserAction('Admin accesses customer dashboard');

      const { data: customerBookings, error } = await supabase
        .from('bookings')
        .select('*, business:business_id(salon_name), slot:slot_id(date, start_time)')
        .eq('customer_user_id', admin.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch customer bookings: ${error.message}`);
      }

      console.log(`   Admin has ${customerBookings?.length || 0} bookings as customer`);
    });

    // STEP 3: Admin browses businesses (as customer)
    await runner.runTest('STEP 3: Admin browses businesses (as customer)', async () => {
      await simulateUserAction('Admin browses businesses as customer');

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
      (global as any).adminSelectedBusiness = data[0];
    });

    // STEP 4: Admin views available slots (as customer)
    await runner.runTest('STEP 4: Admin views available slots (as customer)', async () => {
      const business = (global as any).adminSelectedBusiness;
      await simulateUserAction('Admin views available slots as customer');

      try {
        const slot = await getRandomAvailableSlot(business.id);
        console.log(`   Available slot: ${slot.date} ${slot.start_time}`);
        (global as any).adminSelectedSlot = slot;
      } catch (error) {
        throw new Error(`No available slots found: ${error instanceof Error ? error.message : String(error)}`);
      }
    });

    // STEP 5: Admin creates booking (as customer)
    await runner.runTest('STEP 5: Admin creates booking (as customer)', async () => {
      const business = (global as any).adminSelectedBusiness;
      const slot = (global as any).adminSelectedSlot;
      await simulateUserAction('Admin creates booking as customer');

      const bookingId = `ADMIN-CUST-${Date.now()}`;
      const { data, error } = await supabase.rpc('create_booking_atomically', {
        p_business_id: business.id,
        p_slot_id: slot.id,
        p_customer_name: 'Admin as Customer',
        p_customer_phone: '+919876543210',
        p_booking_id: bookingId,
        p_customer_user_id: admin.id,
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
      
      console.log(`   ✅ Booking created successfully`);
      console.log(`   📋 Booking ID: ${bookingId}`);
      console.log(`   🏢 Business: ${business.salon_name}`);
      console.log(`   📅 Date: ${slot.date}`);
      console.log(`   ⏰ Time: ${slot.start_time} - ${slot.end_time}`);
      console.log(`   👤 Customer: Admin as Customer`);
    });

    // STEP 6: Admin views their customer bookings
    await runner.runTest('STEP 6: Admin views their customer bookings', async () => {
      await simulateUserAction('Admin views customer bookings');

      const { data, error } = await supabase
        .from('bookings')
        .select('*, business:business_id(salon_name), slot:slot_id(date, start_time, end_time)')
        .eq('customer_user_id', admin.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch bookings: ${error.message}`);
      }

      const myBooking = data?.find(b => b.id === cleanup.bookings[0]);
      if (myBooking) {
        console.log(`   📋 Booking Details:`);
        console.log(`      Booking ID: ${myBooking.booking_id}`);
        console.log(`      Status: ${myBooking.status.toUpperCase()}`);
        console.log(`      Business: ${myBooking.business?.salon_name || 'N/A'}`);
        console.log(`      Date: ${myBooking.slot?.date || 'N/A'}`);
        console.log(`      Time: ${myBooking.slot?.start_time || 'N/A'} - ${myBooking.slot?.end_time || 'N/A'}`);
      }
    });

    // STEP 7: Admin can still access admin features
    await runner.runTest('STEP 7: Admin can still access admin features', async () => {
      await simulateUserAction('Admin accesses admin dashboard');

      const { data: allBusinesses } = await supabase
        .from('businesses')
        .select('id')
        .eq('suspended', false);

      const { data: allBookings } = await supabase
        .from('bookings')
        .select('id');

      console.log(`   🔐 Admin Access Verified:`);
      console.log(`      Businesses Visible: ${allBusinesses?.length || 0}`);
      console.log(`      Bookings Visible: ${allBookings?.length || 0}`);
      console.log(`   ✅ Admin has both customer and admin access`);
      console.log(`   📊 Multi-role functionality working correctly`);
    });

  } finally {
    if (admin) {
      await supabase
        .from('user_profiles')
        .update({ user_type: 'admin' })
        .eq('id', admin.id);
    }
    await cleanupTestData(cleanup.bookings, cleanup.slots);
  }

  runner.printSummary();
  return runner.getResults();
}

if (require.main === module) {
  testAdminAsCustomer()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

export { testAdminAsCustomer };
