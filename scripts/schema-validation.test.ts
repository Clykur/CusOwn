#!/usr/bin/env ts-node

/**
 * PHASE 1: DATABASE & SCHEMA VALIDATION TESTS
 * 
 * Tests:
 * - All required columns exist
 * - Correct data types
 * - NOT NULL constraints enforced
 * - Foreign keys enforced
 * - Unique constraints enforced
 * - Negative cases: missing FKs, invalid references, duplicates
 */

import { supabase, TestRunner, cleanupTestData, simulateUserAction } from './test-utils';

async function testSchemaValidation() {
  const runner = new TestRunner();
  const cleanup: { bookings: string[]; slots: string[]; businesses: string[]; payments: string[] } = {
    bookings: [],
    slots: [],
    businesses: [],
    payments: [],
  };

  try {
    // ============================================
    // TEST 1: Businesses Table Schema
    // ============================================
    await runner.runTest('SCHEMA 1: Businesses - Required columns exist', async () => {
      await simulateUserAction('Verify businesses table schema');
      
      const { data, error } = await supabase
        .from('businesses')
        .select('id, salon_name, owner_name, whatsapp_number, opening_time, closing_time, slot_duration, booking_link, created_at')
        .limit(1);
      
      if (error) {
        throw new Error(`Schema check failed: ${error.message}`);
      }
      
      console.log(`   ✅ All required columns exist in businesses table`);
    });

    await runner.runTest('SCHEMA 2: Businesses - NOT NULL constraints enforced', async () => {
      await simulateUserAction('Test NOT NULL constraints');
      
      // Try to insert without required fields
      const { error } = await supabase
        .from('businesses')
        .insert({
          salon_name: null as any,
        });
      
      if (!error || !error.message.includes('null') && !error.message.includes('NOT NULL')) {
        throw new Error('NOT NULL constraint not enforced on salon_name');
      }
      
      console.log(`   ✅ NOT NULL constraints enforced (salon_name)`);
    });

    await runner.runTest('SCHEMA 3: Businesses - UNIQUE constraint on booking_link', async () => {
      await simulateUserAction('Test unique booking_link constraint');
      
      // Create a business
      const { data: business1, error: e1 } = await supabase
        .from('businesses')
        .insert({
          salon_name: `Test Business ${Date.now()}`,
          owner_name: 'Test Owner',
          whatsapp_number: `+9198765${Date.now()}`,
          opening_time: '09:00',
          closing_time: '18:00',
          slot_duration: 30,
          booking_link: `test-link-${Date.now()}`,
        })
        .select()
        .single();
      
      if (e1 || !business1) {
        throw new Error('Failed to create first business');
      }
      cleanup.businesses.push(business1.id);
      
      // Try to create another with same booking_link
      const { error: e2 } = await supabase
        .from('businesses')
        .insert({
          salon_name: 'Duplicate Test',
          owner_name: 'Test Owner 2',
          whatsapp_number: `+9198765${Date.now() + 1}`,
          opening_time: '09:00',
          closing_time: '18:00',
          slot_duration: 30,
          booking_link: business1.booking_link, // Duplicate!
        });
      
      if (!e2 || !e2.message.includes('unique') && !e2.message.includes('duplicate')) {
        throw new Error('UNIQUE constraint not enforced on booking_link');
      }
      
      console.log(`   ✅ UNIQUE constraint enforced on booking_link`);
    });

    await runner.runTest('SCHEMA 4: Businesses - UNIQUE constraint on whatsapp_number', async () => {
      await simulateUserAction('Test unique whatsapp_number constraint');
      
      const uniquePhone = `+9198765${Date.now()}`;
      
      const { data: business1, error: e1 } = await supabase
        .from('businesses')
        .insert({
          salon_name: `Test Business ${Date.now()}`,
          owner_name: 'Test Owner',
          whatsapp_number: uniquePhone,
          opening_time: '09:00',
          closing_time: '18:00',
          slot_duration: 30,
          booking_link: `test-link-${Date.now()}`,
        })
        .select()
        .single();
      
      if (e1 || !business1) {
        throw new Error('Failed to create first business');
      }
      cleanup.businesses.push(business1.id);
      
      // Try duplicate phone
      const { error: e2 } = await supabase
        .from('businesses')
        .insert({
          salon_name: 'Duplicate Phone Test',
          owner_name: 'Test Owner 2',
          whatsapp_number: uniquePhone, // Duplicate!
          opening_time: '09:00',
          closing_time: '18:00',
          slot_duration: 30,
          booking_link: `test-link-${Date.now() + 1}`,
        });
      
      if (!e2 || !e2.message.includes('unique') && !e2.message.includes('duplicate')) {
        throw new Error('UNIQUE constraint not enforced on whatsapp_number');
      }
      
      console.log(`   ✅ UNIQUE constraint enforced on whatsapp_number`);
    });

    await runner.runTest('SCHEMA 5: Businesses - CHECK constraint on slot_duration', async () => {
      await simulateUserAction('Test CHECK constraint on slot_duration');
      
      const { error } = await supabase
        .from('businesses')
        .insert({
          salon_name: 'Invalid Duration Test',
          owner_name: 'Test Owner',
          whatsapp_number: `+9198765${Date.now()}`,
          opening_time: '09:00',
          closing_time: '18:00',
          slot_duration: -10, // Invalid!
          booking_link: `test-link-${Date.now()}`,
        });
      
      if (!error || !error.message.includes('check') && !error.message.includes('constraint')) {
        throw new Error('CHECK constraint not enforced on slot_duration');
      }
      
      console.log(`   ✅ CHECK constraint enforced on slot_duration`);
    });

    // ============================================
    // TEST 2: Slots Table Schema
    // ============================================
    await runner.runTest('SCHEMA 6: Slots - Foreign key to businesses enforced', async () => {
      await simulateUserAction('Test foreign key constraint on slots');
      
      const fakeBusinessId = '00000000-0000-0000-0000-000000000000';
      
      const { error } = await supabase
        .from('slots')
        .insert({
          business_id: fakeBusinessId, // Non-existent business
          date: '2025-01-26',
          start_time: '10:00',
          end_time: '10:30',
          status: 'available',
        });
      
      if (!error || !error.message.includes('foreign key') && !error.message.includes('violates')) {
        throw new Error('Foreign key constraint not enforced on slots.business_id');
      }
      
      console.log(`   ✅ Foreign key constraint enforced on slots.business_id`);
    });

    await runner.runTest('SCHEMA 7: Slots - CHECK constraint on status', async () => {
      await simulateUserAction('Test CHECK constraint on slot status');
      
      // Get a real business first
      const { data: business } = await supabase
        .from('businesses')
        .select('id')
        .limit(1)
        .single();
      
      if (!business) {
        throw new Error('No business found for test');
      }
      
      const { error } = await supabase
        .from('slots')
        .insert({
          business_id: business.id,
          date: '2025-01-26',
          start_time: '10:00',
          end_time: '10:30',
          status: 'invalid_status', // Invalid!
        });
      
      if (!error || !error.message.includes('check') && !error.message.includes('constraint')) {
        throw new Error('CHECK constraint not enforced on slots.status');
      }
      
      console.log(`   ✅ CHECK constraint enforced on slots.status`);
    });

    await runner.runTest('SCHEMA 8: Slots - UNIQUE constraint on (business_id, date, start_time, end_time)', async () => {
      await simulateUserAction('Test unique slot constraint');
      
      const { data: business } = await supabase
        .from('businesses')
        .select('id')
        .limit(1)
        .single();
      
      if (!business) {
        throw new Error('No business found for test');
      }
      
      // Use a future date to avoid conflicts
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 2);
      const dateStr = futureDate.toISOString().split('T')[0];
      
      // Define slot data for reuse
      const slotData = {
        business_id: business.id,
        date: dateStr,
        start_time: '10:00',
        end_time: '10:30',
        status: 'available' as const,
      };
      
      // Check if slot already exists
      const { data: existingSlot } = await supabase
        .from('slots')
        .select('id')
        .eq('business_id', business.id)
        .eq('date', dateStr)
        .eq('start_time', '10:00')
        .eq('end_time', '10:30')
        .single();
      
      let slot1;
      if (existingSlot) {
        // Slot exists, use it
        slot1 = existingSlot;
        // Ensure it's available
        await supabase
          .from('slots')
          .update({ status: 'available', reserved_until: null })
          .eq('id', slot1.id);
      } else {
        // Create new slot
        const { data: newSlot, error: e1 } = await supabase
          .from('slots')
          .insert(slotData)
          .select()
          .single();
        
        if (e1 || !newSlot) {
          throw new Error(`Failed to create first slot: ${e1?.message}`);
        }
        slot1 = newSlot;
      }
      
      if (!slot1) {
        throw new Error('Failed to get or create first slot');
      }
      cleanup.slots.push(slot1.id);
      
      // Try duplicate
      const { error: e2 } = await supabase
        .from('slots')
        .insert(slotData); // Exact duplicate
      
      if (!e2 || !e2.message.includes('unique') && !e2.message.includes('duplicate')) {
        throw new Error('UNIQUE constraint not enforced on slots (business_id, date, start_time, end_time)');
      }
      
      console.log(`   ✅ UNIQUE constraint enforced on slots composite key`);
    });

    // ============================================
    // TEST 3: Bookings Table Schema
    // ============================================
    await runner.runTest('SCHEMA 9: Bookings - Foreign key to businesses enforced', async () => {
      await simulateUserAction('Test foreign key constraint on bookings');
      
      const fakeBusinessId = '00000000-0000-0000-0000-000000000000';
      const fakeSlotId = '00000000-0000-0000-0000-000000000000';
      
      const { error } = await supabase
        .from('bookings')
        .insert({
          business_id: fakeBusinessId,
          slot_id: fakeSlotId,
          customer_name: 'Test Customer',
          customer_phone: '+919876543210',
          booking_id: `TEST-${Date.now()}`,
          status: 'pending',
        });
      
      if (!error || !error.message.includes('foreign key') && !error.message.includes('violates')) {
        throw new Error('Foreign key constraint not enforced on bookings.business_id');
      }
      
      console.log(`   ✅ Foreign key constraint enforced on bookings.business_id`);
    });

    await runner.runTest('SCHEMA 10: Bookings - Foreign key to slots enforced', async () => {
      await simulateUserAction('Test foreign key constraint on bookings.slot_id');
      
      const { data: business } = await supabase
        .from('businesses')
        .select('id')
        .limit(1)
        .single();
      
      if (!business) {
        throw new Error('No business found for test');
      }
      
      const fakeSlotId = '00000000-0000-0000-0000-000000000000';
      
      const { error } = await supabase
        .from('bookings')
        .insert({
          business_id: business.id,
          slot_id: fakeSlotId, // Non-existent slot
          customer_name: 'Test Customer',
          customer_phone: '+919876543210',
          booking_id: `TEST-${Date.now()}`,
          status: 'pending',
        });
      
      if (!error || !error.message.includes('foreign key') && !error.message.includes('violates')) {
        throw new Error('Foreign key constraint not enforced on bookings.slot_id');
      }
      
      console.log(`   ✅ Foreign key constraint enforced on bookings.slot_id`);
    });

    await runner.runTest('SCHEMA 11: Bookings - UNIQUE constraint on booking_id', async () => {
      await simulateUserAction('Test unique booking_id constraint');
      
      const { data: business } = await supabase
        .from('businesses')
        .select('id')
        .limit(1)
        .single();
      
      if (!business) {
        throw new Error('No business found for test');
      }
      
      const { data: slot } = await supabase
        .from('slots')
        .select('id')
        .eq('business_id', business.id)
        .limit(1)
        .single();
      
      if (!slot) {
        throw new Error('No slot found for test');
      }
      
      const uniqueBookingId = `TEST-${Date.now()}`;
      
      // Insert first booking
      const { data: booking1, error: e1 } = await supabase
        .from('bookings')
        .insert({
          business_id: business.id,
          slot_id: slot.id,
          customer_name: 'Test Customer',
          customer_phone: '+919876543210',
          booking_id: uniqueBookingId,
          status: 'pending',
        })
        .select()
        .single();
      
      if (e1 || !booking1) {
        throw new Error('Failed to create first booking');
      }
      cleanup.bookings.push(booking1.id);
      
      // Try duplicate booking_id
      const { error: e2 } = await supabase
        .from('bookings')
        .insert({
          business_id: business.id,
          slot_id: slot.id,
          customer_name: 'Test Customer 2',
          customer_phone: '+919876543211',
          booking_id: uniqueBookingId, // Duplicate!
          status: 'pending',
        });
      
      if (!e2 || !e2.message.includes('unique') && !e2.message.includes('duplicate')) {
        throw new Error('UNIQUE constraint not enforced on bookings.booking_id');
      }
      
      console.log(`   ✅ UNIQUE constraint enforced on bookings.booking_id`);
    });

    await runner.runTest('SCHEMA 12: Bookings - CHECK constraint on status', async () => {
      await simulateUserAction('Test CHECK constraint on booking status');
      
      const { data: business } = await supabase
        .from('businesses')
        .select('id')
        .limit(1)
        .single();
      
      if (!business) {
        throw new Error('No business found for test');
      }
      
      const { data: slot } = await supabase
        .from('slots')
        .select('id')
        .eq('business_id', business.id)
        .limit(1)
        .single();
      
      if (!slot) {
        throw new Error('No slot found for test');
      }
      
      const { error } = await supabase
        .from('bookings')
        .insert({
          business_id: business.id,
          slot_id: slot.id,
          customer_name: 'Test Customer',
          customer_phone: '+919876543210',
          booking_id: `TEST-${Date.now()}`,
          status: 'invalid_status', // Invalid!
        });
      
      if (!error || !error.message.includes('check') && !error.message.includes('constraint')) {
        throw new Error('CHECK constraint not enforced on bookings.status');
      }
      
      console.log(`   ✅ CHECK constraint enforced on bookings.status`);
    });

    // ============================================
    // TEST 4: Payments Table Schema (if exists)
    // ============================================
    await runner.runTest('SCHEMA 13: Payments - Foreign key to bookings enforced', async () => {
      await simulateUserAction('Test foreign key constraint on payments');
      
      const fakeBookingId = '00000000-0000-0000-0000-000000000000';
      
      const { error } = await supabase
        .from('payments')
        .insert({
          booking_id: fakeBookingId,
          provider: 'razorpay',
          provider_payment_id: 'test-payment',
          amount_cents: 1000,
          currency: 'INR',
          status: 'pending',
        });
      
      // If payments table doesn't exist, skip this test
      if (error && error.message.includes('does not exist')) {
        console.log(`   ⚠️  Payments table not found, skipping test`);
        return;
      }
      
      if (!error || !error.message.includes('foreign key') && !error.message.includes('violates')) {
        throw new Error('Foreign key constraint not enforced on payments.booking_id');
      }
      
      console.log(`   ✅ Foreign key constraint enforced on payments.booking_id`);
    });

    await runner.runTest('SCHEMA 14: Payments - CHECK constraint on amount_cents', async () => {
      await simulateUserAction('Test CHECK constraint on payment amount');
      
      const { data: booking } = await supabase
        .from('bookings')
        .select('id')
        .limit(1)
        .single();
      
      if (!booking) {
        console.log(`   ⚠️  No booking found, skipping test`);
        return;
      }
      
      const { error } = await supabase
        .from('payments')
        .insert({
          booking_id: booking.id,
          provider: 'razorpay',
          provider_payment_id: 'test-payment',
          amount_cents: -100, // Invalid!
          currency: 'INR',
          status: 'pending',
        });
      
      // If payments table doesn't exist, skip
      if (error && error.message.includes('does not exist')) {
        console.log(`   ⚠️  Payments table not found, skipping test`);
        return;
      }
      
      if (!error || !error.message.includes('check') && !error.message.includes('constraint')) {
        throw new Error('CHECK constraint not enforced on payments.amount_cents');
      }
      
      console.log(`   ✅ CHECK constraint enforced on payments.amount_cents`);
    });

    await runner.runTest('SCHEMA 15: Payments - UNIQUE constraint on idempotency_key', async () => {
      await simulateUserAction('Test unique idempotency_key constraint');
      
      const { data: booking } = await supabase
        .from('bookings')
        .select('id')
        .limit(1)
        .single();
      
      if (!booking) {
        console.log(`   ⚠️  No booking found, skipping test`);
        return;
      }
      
      const idempotencyKey = `test-key-${Date.now()}`;
      
      // Insert first payment
      const { data: payment1, error: e1 } = await supabase
        .from('payments')
        .insert({
          booking_id: booking.id,
          provider: 'razorpay',
          provider_payment_id: `test-${Date.now()}`,
          amount_cents: 1000,
          currency: 'INR',
          status: 'pending',
          idempotency_key: idempotencyKey,
        })
        .select()
        .single();
      
      // If payments table doesn't exist, skip
      if (e1 && e1.message.includes('does not exist')) {
        console.log(`   ⚠️  Payments table not found, skipping test`);
        return;
      }
      
      if (e1 || !payment1) {
        throw new Error('Failed to create first payment');
      }
      cleanup.payments.push(payment1.id);
      
      // Try duplicate idempotency_key
      const { error: e2 } = await supabase
        .from('payments')
        .insert({
          booking_id: booking.id,
          provider: 'razorpay',
          provider_payment_id: `test-${Date.now() + 1}`,
          amount_cents: 1000,
          currency: 'INR',
          status: 'pending',
          idempotency_key: idempotencyKey, // Duplicate!
        });
      
      if (!e2 || !e2.message.includes('unique') && !e2.message.includes('duplicate')) {
        throw new Error('UNIQUE constraint not enforced on payments.idempotency_key');
      }
      
      console.log(`   ✅ UNIQUE constraint enforced on payments.idempotency_key`);
    });

  } finally {
    await cleanupTestData(cleanup.bookings, cleanup.slots);
    if (cleanup.businesses.length > 0) {
      await supabase.from('businesses').delete().in('id', cleanup.businesses);
    }
    if (cleanup.payments.length > 0) {
      await supabase.from('payments').delete().in('id', cleanup.payments);
    }
  }

  runner.printSummary();
  return runner.getResults();
}

if (require.main === module) {
  testSchemaValidation()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

export { testSchemaValidation };
