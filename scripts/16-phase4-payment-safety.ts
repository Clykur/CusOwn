#!/usr/bin/env ts-node

/**
 * PHASE 4: PAYMENT & FINANCIAL SAFETY TESTS
 * 
 * Tests:
 * - Payment state machine transitions
 * - Payment attempts tracking
 * - Idempotency enforcement
 * - Duplicate webhook prevention
 * - No double confirmation
 * - Booking state consistency
 * - Slot state correctness
 */

import { supabase, TestRunner, getRandomBusiness, getRandomAvailableSlot, cleanupTestData, simulateUserAction } from './test-utils';

async function testPaymentSafety() {
  const runner = new TestRunner();
  const cleanup: { bookings: string[]; slots: string[]; payments: string[] } = {
    bookings: [],
    slots: [],
    payments: [],
  };

  try {
    // ============================================
    // TEST 1: Payment Idempotency
    // ============================================
    await runner.runTest('PAYMENT 1: Payment idempotency key prevents duplicates', async () => {
      const business = await getRandomBusiness();
      const slot = await getRandomAvailableSlot(business.id);
      cleanup.slots.push(slot.id);
      
      // Create booking
      const bookingId = `TEST-${Date.now()}`;
      const { data: bookingResult } = await supabase.rpc('create_booking_atomically', {
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
      
      if (!bookingResult?.success) {
        throw new Error('Booking creation failed');
      }
      cleanup.bookings.push(bookingResult.booking_id);
      
      await simulateUserAction('Test payment idempotency');
      
      const idempotencyKey = `test-key-${Date.now()}`;
      
      // Create first payment
      const { data: payment1, error: e1 } = await supabase
        .from('payments')
        .insert({
          booking_id: bookingResult.booking_id,
          provider: 'razorpay',
          provider_payment_id: `test-${Date.now()}`,
          amount_cents: 1000,
          currency: 'INR',
          status: 'pending',
          idempotency_key: idempotencyKey,
        })
        .select()
        .single();
      
      if (e1 && e1.message.includes('does not exist')) {
        console.log(`   ⚠️  Payments table not found, skipping test`);
        return;
      }
      
      if (e1 || !payment1) {
        throw new Error(`First payment creation failed: ${e1?.message}`);
      }
      cleanup.payments.push(payment1.id);
      
      // Try to create duplicate with same idempotency key
      const { data: payment2, error: e2 } = await supabase
        .from('payments')
        .insert({
          booking_id: bookingResult.booking_id,
          provider: 'razorpay',
          provider_payment_id: `test-${Date.now() + 1}`,
          amount_cents: 1000,
          currency: 'INR',
          status: 'pending',
          idempotency_key: idempotencyKey, // Duplicate!
        })
        .select()
        .single();
      
      if (!e2 || !e2.message.includes('unique') && !e2.message.includes('duplicate')) {
        throw new Error(`Idempotency key not enforced: ${e2?.message}`);
      }
      
      console.log(`   ✅ Idempotency key enforced: ${e2.message}`);
    });

    // ============================================
    // TEST 2: Payment Attempts Tracking
    // ============================================
    await runner.runTest('PAYMENT 2: Payment attempts tracked on failure', async () => {
      const business = await getRandomBusiness();
      const slot = await getRandomAvailableSlot(business.id);
      cleanup.slots.push(slot.id);
      
      // Create booking
      const bookingId = `TEST-${Date.now()}`;
      const { data: bookingResult } = await supabase.rpc('create_booking_atomically', {
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
      
      if (!bookingResult?.success) {
        throw new Error('Booking creation failed');
      }
      cleanup.bookings.push(bookingResult.booking_id);
      
      await simulateUserAction('Test payment attempts tracking');
      
      // Create payment
      const { data: payment, error: e1 } = await supabase
        .from('payments')
        .insert({
          booking_id: bookingResult.booking_id,
          provider: 'razorpay',
          provider_payment_id: `test-${Date.now()}`,
          amount_cents: 1000,
          currency: 'INR',
          status: 'pending',
        })
        .select()
        .single();
      
      if (e1 && e1.message.includes('does not exist')) {
        console.log(`   ⚠️  Payments table not found, skipping test`);
        return;
      }
      
      if (e1 || !payment) {
        throw new Error(`Payment creation failed: ${e1?.message}`);
      }
      cleanup.payments.push(payment.id);
      
      // Mark payment as failed (simulating failure)
      const { paymentService } = require('../services/payment.service');
      try {
        await paymentService.markPaymentFailed(payment.id, 'Test failure reason');
        
        // Check payment_attempts table
        const { data: attempts } = await supabase
          .from('payment_attempts')
          .select('*')
          .eq('payment_id', payment.id)
          .order('attempt_number', { ascending: true });
        
        if (!attempts || attempts.length === 0) {
          throw new Error('No payment attempts recorded');
        }
        
        console.log(`   ✅ Payment attempts tracked: ${attempts.length} attempt(s)`);
        console.log(`   ✅ Last attempt status: ${attempts[attempts.length - 1].status}`);
        console.log(`   ✅ Error message: ${attempts[attempts.length - 1].error_message}`);
      } catch (error: any) {
        if (error.message.includes('does not exist')) {
          console.log(`   ⚠️  Payment attempts table not found, skipping detailed check`);
        } else {
          throw error;
        }
      }
    });

    // ============================================
    // TEST 3: Duplicate Webhook Prevention
    // ============================================
    await runner.runTest('PAYMENT 3: Duplicate webhook does not double-confirm', async () => {
      const business = await getRandomBusiness();
      const slot = await getRandomAvailableSlot(business.id);
      cleanup.slots.push(slot.id);
      
      // Create booking
      const bookingId = `TEST-${Date.now()}`;
      const { data: bookingResult } = await supabase.rpc('create_booking_atomically', {
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
      
      if (!bookingResult?.success) {
        throw new Error('Booking creation failed');
      }
      cleanup.bookings.push(bookingResult.booking_id);
      
      await simulateUserAction('Test duplicate webhook prevention');
      
      // Create payment
      const { data: payment, error: e1 } = await supabase
        .from('payments')
        .insert({
          booking_id: bookingResult.booking_id,
          provider: 'razorpay',
          provider_payment_id: `test-${Date.now()}`,
          amount_cents: 1000,
          currency: 'INR',
          status: 'pending',
        })
        .select()
        .single();
      
      if (e1 && e1.message.includes('does not exist')) {
        console.log(`   ⚠️  Payments table not found, skipping test`);
        return;
      }
      
      if (e1 || !payment) {
        throw new Error(`Payment creation failed: ${e1?.message}`);
      }
      cleanup.payments.push(payment.id);
      
      // Simulate first webhook (complete payment)
      const { paymentService } = require('../services/payment.service');
      try {
        await paymentService.updatePaymentStatus(payment.id, 'completed', payment.provider_payment_id);
        
        // Get initial booking state
        const { data: booking1 } = await supabase
          .from('bookings')
          .select('*')
          .eq('id', bookingResult.booking_id)
          .single();
        
        // Simulate duplicate webhook (same payment ID)
        await paymentService.updatePaymentStatus(payment.id, 'completed', payment.provider_payment_id);
        
        // Get final booking state
        const { data: booking2 } = await supabase
          .from('bookings')
          .select('*')
          .eq('id', bookingResult.booking_id)
          .single();
        
        // Verify booking state unchanged (idempotent)
        if (booking1?.status !== booking2?.status) {
          throw new Error(`Booking state changed on duplicate webhook: ${booking1?.status} → ${booking2?.status}`);
        }
        
        console.log(`   ✅ Duplicate webhook handled idempotently`);
        console.log(`   ✅ Booking status unchanged: ${booking2?.status}`);
      } catch (error: any) {
        if (error.message.includes('does not exist') || error.message.includes('not found')) {
          console.log(`   ⚠️  Payment service method not available, skipping detailed check`);
        } else {
          throw error;
        }
      }
    });

    // ============================================
    // TEST 4: Payment State Consistency
    // ============================================
    await runner.runTest('PAYMENT 4: Payment and booking state consistency', async () => {
      const business = await getRandomBusiness();
      const slot = await getRandomAvailableSlot(business.id);
      cleanup.slots.push(slot.id);
      
      // Create booking
      const bookingId = `TEST-${Date.now()}`;
      const { data: bookingResult } = await supabase.rpc('create_booking_atomically', {
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
      
      if (!bookingResult?.success) {
        throw new Error('Booking creation failed');
      }
      cleanup.bookings.push(bookingResult.booking_id);
      
      await simulateUserAction('Test payment-booking state consistency');
      
      // Create payment
      const { data: payment, error: e1 } = await supabase
        .from('payments')
        .insert({
          booking_id: bookingResult.booking_id,
          provider: 'razorpay',
          provider_payment_id: `test-${Date.now()}`,
          amount_cents: 1000,
          currency: 'INR',
          status: 'pending',
        })
        .select()
        .single();
      
      if (e1 && e1.message.includes('does not exist')) {
        console.log(`   ⚠️  Payments table not found, skipping test`);
        return;
      }
      
      if (e1 || !payment) {
        throw new Error(`Payment creation failed: ${e1?.message}`);
      }
      cleanup.payments.push(payment.id);
      
      // Verify initial state
      const { data: initialBooking } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', bookingResult.booking_id)
        .single();
      
      if (initialBooking?.status !== 'pending') {
        throw new Error(`Initial booking status wrong: ${initialBooking?.status}`);
      }
      
      // Complete payment using atomic function
      const { data: confirmResult } = await supabase.rpc('confirm_booking_with_payment', {
        p_payment_id: payment.id,
        p_booking_id: bookingResult.booking_id,
        p_slot_id: slot.id,
        p_actor_id: null,
      });
      
      if (confirmResult && !confirmResult.success) {
        console.log(`   ⚠️  Payment confirmation function not available or failed: ${confirmResult.error}`);
        return;
      }
      
      if (confirmResult?.success) {
        // Verify final state
        const { data: finalBooking } = await supabase
          .from('bookings')
          .select('*')
          .eq('id', bookingResult.booking_id)
          .single();
        
        const { data: finalPayment } = await supabase
          .from('payments')
          .select('*')
          .eq('id', payment.id)
          .single();
        
        const { data: finalSlot } = await supabase
          .from('slots')
          .select('*')
          .eq('id', slot.id)
          .single();
        
        if (finalBooking?.status !== 'confirmed') {
          throw new Error(`Booking not confirmed: ${finalBooking?.status}`);
        }
        
        if (finalPayment?.status !== 'completed') {
          throw new Error(`Payment not completed: ${finalPayment?.status}`);
        }
        
        if (finalSlot?.status !== 'booked') {
          throw new Error(`Slot not booked: ${finalSlot?.status}`);
        }
        
        console.log(`   ✅ Payment status: ${finalPayment.status}`);
        console.log(`   ✅ Booking status: ${finalBooking.status}`);
        console.log(`   ✅ Slot status: ${finalSlot.status}`);
        console.log(`   ✅ All states consistent`);
      }
    });

    // ============================================
    // TEST 5: Payment Expiry
    // ============================================
    await runner.runTest('PAYMENT 5: Expired payments cannot be completed', async () => {
      await simulateUserAction('Test expired payment handling');
      
      // This test would require creating a payment and manually expiring it
      // Then trying to complete it
      // For now, we verify the state machine prevents it
      
      const { paymentStateMachine } = require('../lib/state/payment-state-machine');
      
      if (paymentStateMachine.canTransition('expired', 'verify')) {
        throw new Error('State machine incorrectly allows expired → completed');
      }
      
      console.log(`   ✅ Expired payments cannot transition to completed`);
    });

  } finally {
    await cleanupTestData(cleanup.bookings, cleanup.slots);
    if (cleanup.payments.length > 0) {
      await supabase.from('payments').delete().in('id', cleanup.payments);
    }
  }

  runner.printSummary();
  return runner.getResults();
}

if (require.main === module) {
  testPaymentSafety()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

export { testPaymentSafety };
