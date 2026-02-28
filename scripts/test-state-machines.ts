#!/usr/bin/env ts-node

import {
  supabase,
  TestRunner,
  getRandomBusiness,
  getRandomAvailableSlot,
  cleanupTestData,
} from './test-utils';

async function testStateMachines() {
  const runner = new TestRunner();
  const cleanup: { bookings: string[]; slots: string[] } = {
    bookings: [],
    slots: [],
  };

  try {
    await runner.runTest('Get real business and slot', async () => {
      const business = await getRandomBusiness();
      const slot = await getRandomAvailableSlot(business.id);
      (global as any).testBusiness = business;
      (global as any).testSlot = slot;
    });

    await runner.runTest('Slot: available → reserved (valid transition)', async () => {
      const slot = (global as any).testSlot;

      const { error } = await supabase
        .from('slots')
        .update({
          status: 'reserved',
          reserved_until: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        })
        .eq('id', slot.id)
        .eq('status', 'available');

      if (error) {
        throw new Error(`Failed to reserve slot: ${error.message}`);
      }

      cleanup.slots.push(slot.id);
      console.log(`   Slot transitioned: available → reserved`);
    });

    await runner.runTest('Slot: reserved → booked (valid transition)', async () => {
      const slot = (global as any).testSlot;

      const { error } = await supabase
        .from('slots')
        .update({
          status: 'booked',
          reserved_until: null,
        })
        .eq('id', slot.id)
        .eq('status', 'reserved');

      if (error) {
        throw new Error(`Failed to book slot: ${error.message}`);
      }

      console.log(`   Slot transitioned: reserved → booked`);
    });

    await runner.runTest('Slot: booked → available (invalid transition)', async () => {
      const slot = (global as any).testSlot;

      const { error } = await supabase
        .from('slots')
        .update({
          status: 'available',
        })
        .eq('id', slot.id)
        .eq('status', 'booked');

      if (!error) {
        throw new Error('Should have failed: booked → available is invalid');
      }

      console.log(`   Correctly rejected invalid transition: booked → available`);
    });

    await runner.runTest('Booking: pending → confirmed (valid transition)', async () => {
      const business = (global as any).testBusiness;
      const slot = await getRandomAvailableSlot(business.id);

      const bookingId = `TEST-${Date.now()}`;
      const { data: booking, error: createError } = await supabase
        .from('bookings')
        .insert({
          business_id: business.id,
          slot_id: slot.id,
          customer_name: 'Test Customer',
          customer_phone: '+919876543210',
          booking_id: bookingId,
          status: 'pending',
        })
        .select()
        .single();

      if (createError || !booking) {
        throw new Error(`Failed to create booking: ${createError?.message}`);
      }

      cleanup.bookings.push(booking.id);
      cleanup.slots.push(slot.id);

      const { error: confirmError } = await supabase
        .from('bookings')
        .update({ status: 'confirmed' })
        .eq('id', booking.id)
        .eq('status', 'pending');

      if (confirmError) {
        throw new Error(`Failed to confirm booking: ${confirmError.message}`);
      }

      console.log(`   Booking transitioned: pending → confirmed`);
    });

    await runner.runTest('Booking: confirmed → pending (invalid transition)', async () => {
      const business = (global as any).testBusiness;
      const slot = await getRandomAvailableSlot(business.id);

      const bookingId = `TEST-${Date.now()}-2`;
      const { data: booking, error: createError } = await supabase
        .from('bookings')
        .insert({
          business_id: business.id,
          slot_id: slot.id,
          customer_name: 'Test Customer 2',
          customer_phone: '+919876543211',
          booking_id: bookingId,
          status: 'confirmed',
        })
        .select()
        .single();

      if (createError || !booking) {
        throw new Error(`Failed to create booking: ${createError?.message}`);
      }

      cleanup.bookings.push(booking.id);
      cleanup.slots.push(slot.id);

      const { error: revertError } = await supabase
        .from('bookings')
        .update({ status: 'pending' })
        .eq('id', booking.id)
        .eq('status', 'confirmed');

      if (!revertError) {
        throw new Error('Should have failed: confirmed → pending is invalid');
      }

      console.log(`   Correctly rejected invalid transition: confirmed → pending`);
    });

    await runner.runTest('Payment: initiated → completed (valid transition)', async () => {
      const business = (global as any).testBusiness;
      const slot = await getRandomAvailableSlot(business.id);

      const bookingId = `TEST-${Date.now()}-3`;
      const { data: booking, error: createError } = await supabase
        .from('bookings')
        .insert({
          business_id: business.id,
          slot_id: slot.id,
          customer_name: 'Test Customer 3',
          customer_phone: '+919876543212',
          booking_id: bookingId,
          status: 'pending',
          total_price_cents: 1000,
        })
        .select()
        .single();

      if (createError || !booking) {
        throw new Error(`Failed to create booking: ${createError?.message}`);
      }

      cleanup.bookings.push(booking.id);
      cleanup.slots.push(slot.id);

      const paymentId = `pay_${Date.now()}`;
      const { data: payment, error: paymentError } = await supabase
        .from('payments')
        .insert({
          booking_id: booking.id,
          provider: 'upi',
          provider_payment_id: paymentId,
          payment_id: paymentId,
          amount_cents: 1000,
          currency: 'INR',
          status: 'initiated',
        })
        .select()
        .single();

      if (paymentError || !payment) {
        throw new Error(`Failed to create payment: ${paymentError?.message}`);
      }

      const { error: completeError } = await supabase
        .from('payments')
        .update({ status: 'completed' })
        .eq('id', payment.id)
        .eq('status', 'initiated');

      if (completeError) {
        throw new Error(`Failed to complete payment: ${completeError.message}`);
      }

      console.log(`   Payment transitioned: initiated → completed`);

      await supabase.from('payments').delete().eq('id', payment.id);
    });
  } finally {
    await cleanupTestData(cleanup.bookings, cleanup.slots);
  }

  runner.printSummary();
  return runner.getResults();
}

if (require.main === module) {
  testStateMachines()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

export { testStateMachines };
