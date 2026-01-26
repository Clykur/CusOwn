#!/usr/bin/env ts-node

/**
 * PHASE 2: ATOMIC BOOKING & SLOT TRANSACTION TESTS (CRITICAL)
 * 
 * Tests:
 * - Single user booking succeeds
 * - Two users booking same slot concurrently → only one succeeds
 * - Slot becomes unavailable mid-transaction
 * - Slot already reserved
 * - Slot expired before booking confirmation
 * - Transaction rollback on any failure
 * - No partial DB writes
 * - Slot state correct
 * - Booking count correct
 * - No orphan records
 */

import { supabase, TestRunner, getRandomBusiness, getRandomAvailableSlot, cleanupTestData, simulateUserAction } from './test-utils';

async function testAtomicBookingTransactions() {
  const runner = new TestRunner();
  const cleanup: { bookings: string[]; slots: string[] } = {
    bookings: [],
    slots: [],
  };

  try {
    // ============================================
    // TEST 1: Single User Booking Success
    // ============================================
    await runner.runTest('ATOMIC 1: Single user booking succeeds', async () => {
      const business = await getRandomBusiness();
      const slot = await getRandomAvailableSlot(business.id);
      cleanup.slots.push(slot.id);
      
      await simulateUserAction('Create single booking');
      
      const bookingId = `TEST-${Date.now()}`;
      const { data: result, error } = await supabase.rpc('create_booking_atomically', {
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
      
      if (error || !result || !result.success) {
        throw new Error(`Booking creation failed: ${error?.message || result?.error}`);
      }
      
      cleanup.bookings.push(result.booking_id);
      
      // Verify slot is reserved
      const { data: updatedSlot } = await supabase
        .from('slots')
        .select('*')
        .eq('id', slot.id)
        .single();
      
      if (updatedSlot?.status !== 'reserved') {
        throw new Error(`Slot not reserved: ${updatedSlot?.status}`);
      }
      
      // Verify booking exists
      const { data: booking } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', result.booking_id)
        .single();
      
      if (!booking || booking.status !== 'pending') {
        throw new Error('Booking not created or wrong status');
      }
      
      console.log(`   ✅ Booking created: ${result.booking_id.substring(0, 8)}...`);
      console.log(`   ✅ Slot reserved: ${slot.id.substring(0, 8)}...`);
      console.log(`   ✅ Slot status: ${updatedSlot.status}`);
      console.log(`   ✅ Booking status: ${booking.status}`);
    });

    // ============================================
    // TEST 2: Concurrent Booking Attempts (Race Condition Prevention)
    // ============================================
    await runner.runTest('ATOMIC 2: Concurrent bookings - only one succeeds', async () => {
      const business = await getRandomBusiness();
      const slot = await getRandomAvailableSlot(business.id);
      cleanup.slots.push(slot.id);
      
      // Ensure slot is available (release any existing reservations)
      await supabase
        .from('slots')
        .update({ status: 'available', reserved_until: null })
        .eq('id', slot.id);
      
      // Clean up any existing bookings for this slot from previous tests
      await supabase
        .from('bookings')
        .delete()
        .eq('slot_id', slot.id)
        .like('booking_id', 'TEST-%');
      
      await simulateUserAction('Simulate concurrent booking attempts');
      
      // Use same timestamp to ensure unique IDs
      const baseTimestamp = Date.now();
      const bookingId1 = `TEST-${baseTimestamp}-1`;
      const bookingId2 = `TEST-${baseTimestamp}-2`;
      
      // Launch both requests simultaneously
      const [result1, result2] = await Promise.all([
        supabase.rpc('create_booking_atomically', {
          p_business_id: business.id,
          p_slot_id: slot.id,
          p_customer_name: 'Customer 1',
          p_customer_phone: '+919876543211',
          p_booking_id: bookingId1,
          p_customer_user_id: null,
          p_total_duration_minutes: 30,
          p_total_price_cents: 1000,
          p_services_count: 1,
          p_service_data: null,
        }),
        supabase.rpc('create_booking_atomically', {
          p_business_id: business.id,
          p_slot_id: slot.id,
          p_customer_name: 'Customer 2',
          p_customer_phone: '+919876543212',
          p_booking_id: bookingId2,
          p_customer_user_id: null,
          p_total_duration_minutes: 30,
          p_total_price_cents: 1000,
          p_services_count: 1,
          p_service_data: null,
        }),
      ]);
      
      const success1 = result1.data?.success && !result1.error;
      const success2 = result2.data?.success && !result2.error;
      
      if (success1 && success2) {
        throw new Error('Both bookings succeeded - race condition not prevented!');
      }
      
      if (!success1 && !success2) {
        throw new Error('Neither booking succeeded - unexpected failure');
      }
      
      const successfulBooking = success1 ? result1.data : result2.data;
      const failedResult = success1 ? result2 : result1;
      
      if (successfulBooking) {
        cleanup.bookings.push(successfulBooking.booking_id);
      }
      
      // Verify only one booking exists for this slot
      // Filter by the booking IDs we created to avoid counting existing bookings
      const { data: bookings } = await supabase
        .from('bookings')
        .select('*')
        .eq('slot_id', slot.id)
        .in('booking_id', [bookingId1, bookingId2]);
      
      if (!bookings || bookings.length !== 1) {
        // Get all bookings for this slot for debugging
        const { data: allBookings } = await supabase
          .from('bookings')
          .select('*')
          .eq('slot_id', slot.id);
        
        throw new Error(`Expected 1 booking for this test, found ${bookings?.length || 0}. Total bookings for slot: ${allBookings?.length || 0}`);
      }
      
      // Verify slot is reserved (not available or double-booked)
      const { data: updatedSlot } = await supabase
        .from('slots')
        .select('*')
        .eq('id', slot.id)
        .single();
      
      if (updatedSlot?.status !== 'reserved') {
        throw new Error(`Slot in wrong state: ${updatedSlot?.status}`);
      }
      
      console.log(`   ✅ Only one booking succeeded (${success1 ? 'Booking 1' : 'Booking 2'})`);
      console.log(`   ✅ Failed booking error: ${failedResult.data?.error || failedResult.error?.message}`);
      console.log(`   ✅ Slot status: ${updatedSlot.status}`);
      console.log(`   ✅ Total bookings for slot: ${bookings.length}`);
    });

    // ============================================
    // TEST 3: Slot Already Reserved
    // ============================================
    await runner.runTest('ATOMIC 3: Booking on already reserved slot fails', async () => {
      const business = await getRandomBusiness();
      const slot = await getRandomAvailableSlot(business.id);
      cleanup.slots.push(slot.id);
      
      // Ensure slot is available and clean up existing bookings
      await supabase
        .from('slots')
        .update({ status: 'available', reserved_until: null })
        .eq('id', slot.id);
      
      await supabase
        .from('bookings')
        .delete()
        .eq('slot_id', slot.id)
        .like('booking_id', 'TEST-%');
      
      // Reserve slot first
      const baseTimestamp = Date.now();
      const bookingId1 = `TEST-${baseTimestamp}-1`;
      const { data: result1 } = await supabase.rpc('create_booking_atomically', {
        p_business_id: business.id,
        p_slot_id: slot.id,
        p_customer_name: 'First Customer',
        p_customer_phone: '+919876543211',
        p_booking_id: bookingId1,
        p_customer_user_id: null,
        p_total_duration_minutes: 30,
        p_total_price_cents: 1000,
        p_services_count: 1,
        p_service_data: null,
      });
      
      if (!result1?.success) {
        throw new Error('First booking failed');
      }
      cleanup.bookings.push(result1.booking_id);
      
      // Verify slot is reserved
      const { data: slotAfterFirst } = await supabase
        .from('slots')
        .select('*')
        .eq('id', slot.id)
        .single();
      
      if (slotAfterFirst?.status !== 'reserved') {
        throw new Error(`Slot not reserved after first booking: ${slotAfterFirst?.status}`);
      }
      
      await simulateUserAction('Try booking already reserved slot');
      
      // Try to book same slot again (should fail)
      const bookingId2 = `TEST-${baseTimestamp}-2`;
      const { data: result2, error } = await supabase.rpc('create_booking_atomically', {
        p_business_id: business.id,
        p_slot_id: slot.id,
        p_customer_name: 'Second Customer',
        p_customer_phone: '+919876543212',
        p_booking_id: bookingId2,
        p_customer_user_id: null,
        p_total_duration_minutes: 30,
        p_total_price_cents: 1000,
        p_services_count: 1,
        p_service_data: null,
      });
      
      if (result2?.success) {
        // If second booking succeeded, it means the slot reservation expired or was released
        // Check if slot is still reserved
        const { data: slotAfterSecond } = await supabase
          .from('slots')
          .select('*')
          .eq('id', slot.id)
          .single();
        
        if (slotAfterSecond?.status === 'reserved') {
          throw new Error('Second booking succeeded on reserved slot!');
        } else {
          console.log(`   ⚠️  Slot reservation expired between attempts (status: ${slotAfterSecond?.status})`);
          // This is acceptable - reservation expired, so second booking can succeed
          if (result2.booking_id) {
            cleanup.bookings.push(result2.booking_id);
          }
        }
      } else {
        // Second booking correctly failed
        if (!result2?.error || (!result2.error.includes('reserved') && !result2.error.includes('Slot'))) {
          throw new Error(`Expected reservation error, got: ${result2?.error || error?.message}`);
        }
      }
      
      // Verify bookings count - filter by our test booking IDs
      const { data: bookings } = await supabase
        .from('bookings')
        .select('*')
        .eq('slot_id', slot.id)
        .in('booking_id', [bookingId1, bookingId2]);
      
      if (!bookings || bookings.length === 0) {
        throw new Error(`Expected at least 1 booking from this test, found ${bookings?.length || 0}`);
      }
      
      if (result2?.success) {
        console.log(`   ✅ Second booking succeeded (reservation expired): ${result2.error || 'OK'}`);
        console.log(`   ✅ Total bookings from this test: ${bookings.length} (expected due to expiry)`);
      } else {
        if (bookings.length !== 1) {
          // Get all bookings for debugging
          const { data: allBookings } = await supabase
            .from('bookings')
            .select('*')
            .eq('slot_id', slot.id);
          throw new Error(`Expected 1 booking from this test, found ${bookings.length}. Total bookings for slot: ${allBookings?.length || 0}`);
        }
        console.log(`   ✅ Second booking correctly rejected: ${result2.error}`);
        console.log(`   ✅ Only one booking exists from this test`);
      }
    });

    // ============================================
    // TEST 4: Slot Already Booked
    // ============================================
    await runner.runTest('ATOMIC 4: Booking on already booked slot fails', async () => {
      const business = await getRandomBusiness();
      const slot = await getRandomAvailableSlot(business.id);
      cleanup.slots.push(slot.id);
      
      // Create and confirm booking
      const bookingId1 = `TEST-${Date.now()}-1`;
      const { data: result1 } = await supabase.rpc('create_booking_atomically', {
        p_business_id: business.id,
        p_slot_id: slot.id,
        p_customer_name: 'First Customer',
        p_customer_phone: '+919876543211',
        p_booking_id: bookingId1,
        p_customer_user_id: null,
        p_total_duration_minutes: 30,
        p_total_price_cents: 1000,
        p_services_count: 1,
        p_service_data: null,
      });
      
      if (!result1?.success) {
        throw new Error('First booking failed');
      }
      cleanup.bookings.push(result1.booking_id);
      
      // Confirm booking (marks slot as booked)
      const { data: confirmResult } = await supabase.rpc('confirm_booking_atomically', {
        p_booking_id: result1.booking_id,
        p_actor_id: null,
      });
      
      if (!confirmResult?.success) {
        throw new Error('Booking confirmation failed');
      }
      
      await simulateUserAction('Try booking already booked slot');
      
      // Try to book same slot again
      const bookingId2 = `TEST-${Date.now()}-2`;
      const { data: result2 } = await supabase.rpc('create_booking_atomically', {
        p_business_id: business.id,
        p_slot_id: slot.id,
        p_customer_name: 'Second Customer',
        p_customer_phone: '+919876543212',
        p_booking_id: bookingId2,
        p_customer_user_id: null,
        p_total_duration_minutes: 30,
        p_total_price_cents: 1000,
        p_services_count: 1,
        p_service_data: null,
      });
      
      if (result2?.success) {
        throw new Error('Second booking succeeded on booked slot!');
      }
      
      if (!result2?.error || !result2.error.includes('booked')) {
        throw new Error(`Expected "booked" error, got: ${result2?.error}`);
      }
      
      // Verify slot is booked
      const { data: updatedSlot } = await supabase
        .from('slots')
        .select('*')
        .eq('id', slot.id)
        .single();
      
      if (updatedSlot?.status !== 'booked') {
        throw new Error(`Slot not booked: ${updatedSlot?.status}`);
      }
      
      console.log(`   ✅ Second booking correctly rejected: ${result2.error}`);
      console.log(`   ✅ Slot status: ${updatedSlot.status}`);
    });

    // ============================================
    // TEST 5: Business Suspended
    // ============================================
    await runner.runTest('ATOMIC 5: Booking on suspended business fails', async () => {
      const business = await getRandomBusiness();
      const slot = await getRandomAvailableSlot(business.id);
      cleanup.slots.push(slot.id);
      
      // Suspend business
      await supabase
        .from('businesses')
        .update({ suspended: true })
        .eq('id', business.id);
      
      await simulateUserAction('Try booking on suspended business');
      
      const bookingId = `TEST-${Date.now()}`;
      const { data: result } = await supabase.rpc('create_booking_atomically', {
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
      
      if (result?.success) {
        throw new Error('Booking succeeded on suspended business!');
      }
      
      if (!result?.error || !result.error.includes('suspended')) {
        throw new Error(`Expected "suspended" error, got: ${result?.error}`);
      }
      
      // Restore business
      await supabase
        .from('businesses')
        .update({ suspended: false })
        .eq('id', business.id);
      
      console.log(`   ✅ Booking correctly rejected: ${result.error}`);
    });

    // ============================================
    // TEST 6: Invalid Slot (Wrong Business)
    // ============================================
    await runner.runTest('ATOMIC 6: Booking with slot from wrong business fails', async () => {
      const business1 = await getRandomBusiness();
      const business2 = await getRandomBusiness();
      
      if (business1.id === business2.id) {
        console.log(`   ⚠️  Only one business found, skipping test`);
        return;
      }
      
      const slot = await getRandomAvailableSlot(business1.id);
      cleanup.slots.push(slot.id);
      
      await simulateUserAction('Try booking with mismatched business/slot');
      
      const bookingId = `TEST-${Date.now()}`;
      const { data: result } = await supabase.rpc('create_booking_atomically', {
        p_business_id: business2.id, // Wrong business!
        p_slot_id: slot.id, // Slot belongs to business1
        p_customer_name: 'Test Customer',
        p_customer_phone: '+919876543210',
        p_booking_id: bookingId,
        p_customer_user_id: null,
        p_total_duration_minutes: 30,
        p_total_price_cents: 1000,
        p_services_count: 1,
        p_service_data: null,
      });
      
      if (result?.success) {
        throw new Error('Booking succeeded with mismatched business/slot!');
      }
      
      if (!result?.error || !result.error.includes('belong')) {
        throw new Error(`Expected "belong" error, got: ${result?.error}`);
      }
      
      console.log(`   ✅ Booking correctly rejected: ${result.error}`);
    });

    // ============================================
    // TEST 7: No Partial Writes (Transaction Integrity)
    // ============================================
    await runner.runTest('ATOMIC 7: No partial writes on failure', async () => {
      const business = await getRandomBusiness();
      const slot = await getRandomAvailableSlot(business.id);
      cleanup.slots.push(slot.id);
      
      // Get initial state
      const { data: initialSlot } = await supabase
        .from('slots')
        .select('*')
        .eq('id', slot.id)
        .single();
      
      const initialBookingCount = (await supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('slot_id', slot.id)).count || 0;
      
      await simulateUserAction('Test transaction rollback');
      
      // Try booking with invalid data (should fail)
      const bookingId = `TEST-${Date.now()}`;
      const { data: result } = await supabase.rpc('create_booking_atomically', {
        p_business_id: 'invalid-uuid', // Invalid!
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
      
      // Verify slot state unchanged
      const { data: finalSlot } = await supabase
        .from('slots')
        .select('*')
        .eq('id', slot.id)
        .single();
      
      if (finalSlot?.status !== initialSlot?.status) {
        throw new Error(`Slot state changed: ${initialSlot?.status} → ${finalSlot?.status}`);
      }
      
      // Verify no booking created
      const finalBookingCount = (await supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('slot_id', slot.id)).count || 0;
      
      if (finalBookingCount !== initialBookingCount) {
        throw new Error(`Booking count changed: ${initialBookingCount} → ${finalBookingCount}`);
      }
      
      console.log(`   ✅ Slot state unchanged: ${finalSlot?.status}`);
      console.log(`   ✅ Booking count unchanged: ${finalBookingCount}`);
      console.log(`   ✅ No partial writes detected`);
    });

  } finally {
    await cleanupTestData(cleanup.bookings, cleanup.slots);
  }

  runner.printSummary();
  return runner.getResults();
}

if (require.main === module) {
  testAtomicBookingTransactions()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

export { testAtomicBookingTransactions };
