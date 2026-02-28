#!/usr/bin/env ts-node

import {
  supabase,
  TestRunner,
  getRandomBusiness,
  getRandomAvailableSlot,
  cleanupTestData,
} from './test-utils';

async function testAtomicBookingCreation() {
  const runner = new TestRunner();
  const cleanup: { bookings: string[]; slots: string[] } = {
    bookings: [],
    slots: [],
  };

  try {
    await runner.runTest('Get real business and slot', async () => {
      const business = await getRandomBusiness();
      const slot = await getRandomAvailableSlot(business.id);
      console.log(`   Business: ${business.salon_name} (${business.id.substring(0, 8)}...)`);
      console.log(`   Slot: ${slot.date} ${slot.start_time} (${slot.id.substring(0, 8)}...)`);
      (global as any).testBusiness = business;
      (global as any).testSlot = slot;
    });

    await runner.runTest('Create booking atomically', async () => {
      const business = (global as any).testBusiness;
      const slot = (global as any).testSlot;

      const bookingId = `TEST-${Date.now()}`;
      const customerName = 'Test Customer';
      const customerPhone = '+919876543210';

      const { data, error } = await supabase.rpc('create_booking_atomically', {
        p_business_id: business.id,
        p_slot_id: slot.id,
        p_customer_name: customerName,
        p_customer_phone: customerPhone,
        p_booking_id: bookingId,
        p_customer_user_id: null,
        p_total_duration_minutes: 30,
        p_total_price_cents: 1000,
        p_services_count: 1,
        p_service_data: null,
      });

      if (error || !data || !data.success) {
        throw new Error(error?.message || data?.error || 'Booking creation failed');
      }

      console.log(`   Booking created: ${data.booking_id}`);
      cleanup.bookings.push(data.booking_id);
      cleanup.slots.push(slot.id);
      (global as any).testBookingId = data.booking_id;
    });

    await runner.runTest('Verify slot is reserved', async () => {
      const slot = (global as any).testSlot;
      const { data, error } = await supabase.from('slots').select('*').eq('id', slot.id).single();

      if (error || !data) {
        throw new Error('Failed to fetch slot');
      }

      if (data.status !== 'reserved') {
        throw new Error(`Expected slot status 'reserved', got '${data.status}'`);
      }

      if (!data.reserved_until) {
        throw new Error('Slot reserved_until is not set');
      }

      console.log(`   Slot status: ${data.status}`);
      console.log(`   Reserved until: ${data.reserved_until}`);
    });

    await runner.runTest('Verify booking exists', async () => {
      const bookingId = (global as any).testBookingId;
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', bookingId)
        .single();

      if (error || !data) {
        throw new Error('Failed to fetch booking');
      }

      if (data.status !== 'pending') {
        throw new Error(`Expected booking status 'pending', got '${data.status}'`);
      }

      console.log(`   Booking status: ${data.status}`);
      console.log(`   Customer: ${data.customer_name}`);
    });

    await runner.runTest('Prevent double booking (concurrent test)', async () => {
      const business = (global as any).testBusiness;
      const slot = (global as any).testSlot;

      const bookingId2 = `TEST-${Date.now()}-2`;
      const { data, error } = await supabase.rpc('create_booking_atomically', {
        p_business_id: business.id,
        p_slot_id: slot.id,
        p_customer_name: 'Test Customer 2',
        p_customer_phone: '+919876543211',
        p_booking_id: bookingId2,
        p_customer_user_id: null,
        p_total_duration_minutes: 30,
        p_total_price_cents: 1000,
        p_services_count: 1,
        p_service_data: null,
      });

      if (data?.success) {
        throw new Error('Double booking should have failed but succeeded');
      }

      if (!error && data?.error) {
        console.log(`   Correctly rejected: ${data.error}`);
      } else {
        throw new Error('Expected rejection but got unexpected result');
      }
    });
  } finally {
    await cleanupTestData(cleanup.bookings, cleanup.slots);
  }

  runner.printSummary();
  return runner.getResults();
}

if (require.main === module) {
  testAtomicBookingCreation()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

export { testAtomicBookingCreation };
