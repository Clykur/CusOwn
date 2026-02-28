#!/usr/bin/env ts-node
import {
  supabase,
  TestRunner,
  getRandomBusiness,
  getRandomAvailableSlot,
  getOrCreateTestUser,
  cleanupTestData,
  simulateUserAction,
} from './test-utils';
async function testBookingFlow() {
  const runner = new TestRunner();
  const cleanup: { bookings: string[]; slots: string[]; payments: string[] } = {
    bookings: [],
    slots: [],
    payments: [],
  };
  let customer: any = null;
  let bookingId: string | null = null;
  try {
    await runner.runTest('STEP 1: User browses and selects business', async () => {
      customer = await getOrCreateTestUser(`test-booking-${Date.now()}@test.com`, 'customer');
      await simulateUserAction('User browses businesses');
      const business = await getRandomBusiness();
      (global as any).selectedBusiness = business;
      console.log(`   Selected: ${business.salon_name}`);
    });
    await runner.runTest('STEP 2: User views available slots', async () => {
      const business = (global as any).selectedBusiness;
      await simulateUserAction('User views available slots');

      try {
        const slot = await getRandomAvailableSlot(business.id);
        (global as any).selectedSlot = slot;
        console.log(`   Selected slot: ${slot.date} ${slot.start_time}`);
      } catch (error) {
        throw new Error(
          `No available slots found: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
    await runner.runTest('STEP 3: User creates booking', async () => {
      const business = (global as any).selectedBusiness;
      const slot = (global as any).selectedSlot;
      await simulateUserAction('User creates booking');
      const bookingIdStr = `BOOK-${Date.now()}`;
      const { data, error } = await supabase.rpc('create_booking_atomically', {
        p_business_id: business.id,
        p_slot_id: slot.id,
        p_customer_name: 'Booking Test Customer',
        p_customer_phone: '+919876543210',
        p_booking_id: bookingIdStr,
        p_customer_user_id: customer.id,
        p_total_duration_minutes: 30,
        p_total_price_cents: 1000,
        p_services_count: 1,
        p_service_data: null,
      });
      if (error || !data?.success)
        throw new Error(error?.message || data?.error || 'Booking creation failed');
      bookingId = data.booking_id;
      if (bookingId) {
        cleanup.bookings.push(bookingId);
        cleanup.slots.push(slot.id);
      }

      console.log(`   ✅ Booking created successfully`);
      console.log(`   📋 Booking ID: ${bookingIdStr}`);
      console.log(`   🏢 Business: ${business.salon_name}`);
      console.log(`   📅 Slot: ${slot.date} ${slot.start_time} - ${slot.end_time}`);
      console.log(`   👤 Customer: Booking Test Customer`);
      console.log(`   💰 Price: ₹${(1000 / 100).toFixed(2)}`);
      console.log(`   ⏱️  Duration: 30 minutes`);
    });
    await runner.runTest('STEP 4: Booking is confirmed', async () => {
      if (!bookingId) throw new Error('No booking ID');
      await simulateUserAction('Booking is confirmed');
      const { data, error } = await supabase.rpc('confirm_booking_atomically', {
        p_booking_id: bookingId,
        p_actor_id: null,
      });
      if (error || !data?.success)
        throw new Error(error?.message || data?.error || 'Booking confirmation failed');

      // Fetch updated booking details
      const { data: booking } = await supabase
        .from('bookings')
        .select('*, slot:slot_id(date, start_time, end_time)')
        .eq('id', bookingId)
        .single();

      console.log(`   ✅ Booking confirmed successfully`);
      console.log(`   📋 Booking ID: ${booking?.booking_id || 'N/A'}`);
      console.log(`   📊 Status: ${booking?.status || 'N/A'}`);
      console.log(`   📅 Date: ${booking?.slot?.date || 'N/A'}`);
      console.log(
        `   ⏰ Time: ${booking?.slot?.start_time || 'N/A'} - ${booking?.slot?.end_time || 'N/A'}`
      );
      console.log(`   👤 Customer: ${booking?.customer_name || 'N/A'}`);
    });
  } finally {
    await cleanupTestData(cleanup.bookings, cleanup.slots);
  }
  runner.printSummary();
  return runner.getResults();
}
if (require.main === module) {
  testBookingFlow()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}
export { testBookingFlow };
