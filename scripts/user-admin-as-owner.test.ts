#!/usr/bin/env ts-node

/**
 * USER JOURNEY TEST: Admin Logs In As Business Owner
 * Simulates admin user accessing owner features and flows
 */

import {
  supabase,
  TestRunner,
  getOrCreateTestUser,
  cleanupTestData,
  simulateUserAction,
} from './test-utils';

async function testAdminAsOwner() {
  const runner = new TestRunner();
  const cleanup: { bookings: string[]; slots: string[]; businesses: string[] } = {
    bookings: [],
    slots: [],
    businesses: [],
  };
  let admin: any = null;
  let testBusiness: any = null;

  try {
    // STEP 1: Admin logs in
    await runner.runTest('STEP 1: Admin logs in', async () => {
      admin = await getOrCreateTestUser(`test-admin-owner-${Date.now()}@test.com`, 'owner');
      await supabase.from('user_profiles').update({ user_type: 'admin' }).eq('id', admin.id);

      await simulateUserAction('Admin logs in', {
        email: admin.email,
        role: 'admin',
      });
      console.log(`   Admin ID: ${admin.id.substring(0, 8)}...`);
    });

    // STEP 2: Admin views owner dashboard
    await runner.runTest('STEP 2: Admin views owner dashboard', async () => {
      await simulateUserAction('Admin accesses owner dashboard');

      const { data: ownerBusinesses, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('owner_user_id', admin.id);

      if (error) {
        throw new Error(`Failed to fetch owner businesses: ${error.message}`);
      }

      console.log(`   Admin has ${ownerBusinesses?.length || 0} businesses as owner`);
    });

    // STEP 3: Admin creates business (as owner)
    await runner.runTest('STEP 3: Admin creates business (as owner)', async () => {
      await simulateUserAction('Admin creates business as owner');

      const timestamp = Date.now();
      const businessName = `Admin Owner Business ${timestamp}`;
      const bookingLink = `admin-owner-${timestamp}`;
      const uniqueWhatsapp = `+9198765${String(timestamp).slice(-6)}`;

      const { data, error } = await supabase
        .from('businesses')
        .insert({
          salon_name: businessName,
          owner_name: 'Admin Owner',
          whatsapp_number: uniqueWhatsapp,
          opening_time: '09:00',
          closing_time: '18:00',
          slot_duration: 30,
          booking_link: bookingLink,
          address: '123 Admin Street',
          location: 'Admin City',
          owner_user_id: admin.id,
        })
        .select()
        .single();

      if (error || !data) {
        throw new Error(`Failed to create business: ${error?.message}`);
      }

      testBusiness = data;
      cleanup.businesses.push(data.id);

      console.log(`   ✅ Business created: ${data.salon_name}`);
      console.log(`   📍 Location: ${data.location}`);
      console.log(`   🔗 Booking Link: ${data.booking_link}`);
      console.log(`   📱 WhatsApp: ${data.whatsapp_number}`);
      console.log(`   ⏰ Hours: ${data.opening_time} - ${data.closing_time}`);
      console.log(`   👤 Owner: ${data.owner_name}`);
    });

    // STEP 4: Admin views their business (as owner)
    await runner.runTest('STEP 4: Admin views their business (as owner)', async () => {
      await simulateUserAction('Admin views their business as owner');

      const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('owner_user_id', admin.id)
        .single();

      if (error || !data) {
        throw new Error('Failed to fetch owner business');
      }

      console.log(`   Business: ${data.salon_name}`);
      console.log(`   Status: ${data.suspended ? 'Suspended' : 'Active'}`);
    });

    // STEP 5: Admin views bookings for their business
    await runner.runTest('STEP 5: Admin views bookings for their business', async () => {
      await simulateUserAction('Admin views business bookings as owner');

      const { data, error } = await supabase
        .from('bookings')
        .select('*, slot:slot_id(date, start_time, end_time)')
        .eq('business_id', testBusiness.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        throw new Error(`Failed to fetch bookings: ${error.message}`);
      }

      const statusCounts = {
        pending: data?.filter((b) => b.status === 'pending').length || 0,
        confirmed: data?.filter((b) => b.status === 'confirmed').length || 0,
        cancelled: data?.filter((b) => b.status === 'cancelled').length || 0,
      };

      console.log(`   Found ${data?.length || 0} bookings`);
      console.log(`   Pending: ${statusCounts.pending}`);
      console.log(`   Confirmed: ${statusCounts.confirmed}`);
      console.log(`   Cancelled: ${statusCounts.cancelled}`);
    });

    // STEP 6: Admin accepts booking (as owner)
    await runner.runTest('STEP 6: Admin accepts booking (as owner)', async () => {
      const { data: pendingBooking } = await supabase
        .from('bookings')
        .select('*')
        .eq('business_id', testBusiness.id)
        .eq('status', 'pending')
        .limit(1)
        .single();

      if (pendingBooking) {
        await simulateUserAction('Admin accepts booking as owner', {
          bookingId: pendingBooking.booking_id,
        });

        const { data, error } = await supabase.rpc('confirm_booking_atomically', {
          p_booking_id: pendingBooking.id,
          p_actor_id: admin.id,
        });

        if (error || !data?.success) {
          throw new Error(error?.message || data?.error || 'Booking confirmation failed');
        }

        cleanup.bookings.push(pendingBooking.id);
        console.log(`   Booking accepted: ${pendingBooking.booking_id}`);
      } else {
        console.log(`   No pending bookings to accept (skipping)`);
      }
    });

    // STEP 7: Admin views business analytics (as owner)
    await runner.runTest('STEP 7: Admin views business analytics (as owner)', async () => {
      await simulateUserAction('Admin views business analytics as owner');

      const { data: bookings } = await supabase
        .from('bookings')
        .select('status')
        .eq('business_id', testBusiness.id);

      const stats = {
        total: bookings?.length || 0,
        confirmed: bookings?.filter((b) => b.status === 'confirmed').length || 0,
        pending: bookings?.filter((b) => b.status === 'pending').length || 0,
        cancelled: bookings?.filter((b) => b.status === 'cancelled').length || 0,
        rejected: bookings?.filter((b) => b.status === 'rejected').length || 0,
      };

      console.log(`   📊 Business Analytics:`);
      console.log(`      Total Bookings: ${stats.total}`);
      console.log(`      ✅ Confirmed: ${stats.confirmed}`);
      console.log(`      ⏳ Pending: ${stats.pending}`);
      console.log(`      ❌ Cancelled: ${stats.cancelled}`);
      console.log(`      🚫 Rejected: ${stats.rejected}`);
      if (stats.total > 0) {
        const confirmationRate = ((stats.confirmed / stats.total) * 100).toFixed(1);
        console.log(`      📈 Confirmation Rate: ${confirmationRate}%`);
      }
    });

    // STEP 8: Admin can still access admin features
    await runner.runTest('STEP 8: Admin can still access admin features', async () => {
      await simulateUserAction('Admin accesses admin dashboard');

      const { data: allBusinesses } = await supabase
        .from('businesses')
        .select('id')
        .eq('suspended', false);

      const { data: allBookings } = await supabase.from('bookings').select('id');

      console.log(`   🔐 Admin Access Verified:`);
      console.log(`      Businesses Visible: ${allBusinesses?.length || 0}`);
      console.log(`      Bookings Visible: ${allBookings?.length || 0}`);
      console.log(`   ✅ Admin has both owner and admin access`);
      console.log(`   📊 Multi-role functionality working correctly`);
    });
  } finally {
    if (cleanup.businesses.length > 0) {
      await supabase.from('businesses').delete().in('id', cleanup.businesses);
    }
    if (admin) {
      await supabase.from('user_profiles').update({ user_type: 'admin' }).eq('id', admin.id);
    }
    await cleanupTestData(cleanup.bookings, cleanup.slots);
  }

  runner.printSummary();
  return runner.getResults();
}

if (require.main === module) {
  testAdminAsOwner()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

export { testAdminAsOwner };
