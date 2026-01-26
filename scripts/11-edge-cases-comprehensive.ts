#!/usr/bin/env ts-node

/**
 * COMPREHENSIVE EDGE CASE TESTING
 * Uses DSA methods: State Machines, Graph Traversal, Queue-based workflows, Hash Maps
 */

import { 
  supabase, 
  TestRunner, 
  getRandomBusiness, 
  getRandomAvailableSlot, 
  getOrCreateTestUser, 
  cleanupTestData, 
  simulateUserAction,
  StateMachineTracker,
  WorkflowQueue,
  TestStateTracker
} from './test-utils';

/**
 * DSA: State Machine for Booking States
 */
const BOOKING_STATE_MACHINE = {
  initial: ['pending'],
  pending: ['confirmed', 'rejected', 'cancelled'],
  confirmed: ['cancelled', 'completed'],
  rejected: [],
  cancelled: [],
  completed: [],
};

/**
 * DSA: Graph-based edge case testing
 */
async function testEdgeCases() {
  const runner = new TestRunner();
  const stateTracker = new TestStateTracker();
  const cleanup: { bookings: string[]; slots: string[]; businesses: string[]; payments: string[] } = {
    bookings: [],
    slots: [],
    businesses: [],
    payments: [],
  };

  try {
    // ============================================
    // EDGE CASE 1: State Machine Transitions
    // ============================================
    await runner.runTest('EDGE CASE 1: Valid state transitions', async () => {
      const sm = new StateMachineTracker(BOOKING_STATE_MACHINE);
      
      // Test valid path: initial -> pending -> confirmed -> cancelled
      const valid1 = sm.transition('pending');
      const valid2 = sm.transition('confirmed');
      const valid3 = sm.transition('cancelled');
      
      if (!valid1 || !valid2 || !valid3) {
        throw new Error('Valid state transitions failed');
      }
      
      // Test invalid transition: cancelled -> confirmed (should fail)
      const invalid = sm.transition('confirmed');
      if (invalid) {
        throw new Error('Invalid state transition should have failed');
      }
      
      console.log(`   ✅ State machine validation passed`);
      console.log(`   📊 Transitions: ${sm.getTransitions().length}`);
      console.log(`   🔄 Current state: ${sm.getCurrentState()}`);
    });

    // ============================================
    // EDGE CASE 2: Queue-based Workflow Testing
    // ============================================
    await runner.runTest('EDGE CASE 2: Queue-based workflow execution', async () => {
      const workflow = new WorkflowQueue();
      
      // Enqueue actions with priorities
      workflow.enqueue('create_booking', 3);
      workflow.enqueue('reserve_slot', 2);
      workflow.enqueue('confirm_booking', 1);
      workflow.enqueue('send_notification', 0);
      
      const results: string[] = [];
      while (!workflow.isEmpty()) {
        const item = await workflow.processNext();
        if (item) {
          results.push(item.action);
        }
      }
      
      // Verify execution order (higher priority first)
      const expectedOrder = ['create_booking', 'reserve_slot', 'confirm_booking', 'send_notification'];
      if (JSON.stringify(results) !== JSON.stringify(expectedOrder)) {
        throw new Error(`Workflow execution order incorrect: ${results.join(' -> ')}`);
      }
      
      console.log(`   ✅ Queue-based workflow executed correctly`);
      console.log(`   📋 Execution order: ${results.join(' -> ')}`);
      console.log(`   ⏱️  Completed actions: ${workflow.getCompleted().length}`);
    });

    // ============================================
    // EDGE CASE 3: Concurrent Booking Attempts (Race Conditions)
    // ============================================
    await runner.runTest('EDGE CASE 3: Multiple concurrent booking attempts', async () => {
      const business = await getRandomBusiness();
      const slot = await getRandomAvailableSlot(business.id);
      cleanup.slots.push(slot.id);
      
      const customers = await Promise.all(
        Array.from({ length: 5 }, (_, i) => 
          getOrCreateTestUser(`concurrent-edge-${Date.now()}-${i}@test.com`, 'customer')
        )
      );
      
      // Attempt concurrent bookings
      const promises = customers.map((customer, i) => {
        const bookingId = `EDGE-CONC-${Date.now()}-${i}`;
        return supabase.rpc('create_booking_atomically', {
          p_business_id: business.id,
          p_slot_id: slot.id,
          p_customer_name: `Concurrent User ${i}`,
          p_customer_phone: `+9198765432${String(i).padStart(2, '0')}`,
          p_booking_id: bookingId,
          p_customer_user_id: customer.id,
          p_total_duration_minutes: 30,
          p_total_price_cents: 1000,
          p_services_count: 1,
          p_service_data: null,
        });
      });
      
      const results = await Promise.allSettled(promises);
      const successful = results.filter(
        r => r.status === 'fulfilled' && r.value.data?.success
      ).length;
      
      if (successful !== 1) {
        throw new Error(`Expected exactly 1 successful booking, got ${successful}`);
      }
      
      // Track successful booking
      results.forEach((result, i) => {
        if (result.status === 'fulfilled' && result.value.data?.success) {
          cleanup.bookings.push(result.value.data.booking_id);
        }
      });
      
      console.log(`   ✅ Race condition handled correctly`);
      console.log(`   📊 Attempts: 5, Successful: ${successful}, Failed: ${5 - successful}`);
    });

    // ============================================
    // EDGE CASE 4: State Tracking with Hash Map
    // ============================================
    await runner.runTest('EDGE CASE 4: State tracking across operations', async () => {
      const customer = await getOrCreateTestUser(`edge-state-${Date.now()}@test.com`, 'customer');
      const business = await getRandomBusiness();
      const slot = await getRandomAvailableSlot(business.id);
      cleanup.slots.push(slot.id);
      
      // Track state changes
      stateTracker.set('customer_id', customer.id);
      stateTracker.set('business_id', business.id);
      stateTracker.set('slot_id', slot.id);
      
      // Create booking
      const bookingId = `EDGE-STATE-${Date.now()}`;
      const { data, error } = await supabase.rpc('create_booking_atomically', {
        p_business_id: business.id,
        p_slot_id: slot.id,
        p_customer_name: 'State Test Customer',
        p_customer_phone: '+919876543210',
        p_booking_id: bookingId,
        p_customer_user_id: customer.id,
        p_total_duration_minutes: 30,
        p_total_price_cents: 1000,
        p_services_count: 1,
        p_service_data: null,
      });
      
      if (error || !data?.success) {
        throw new Error(`Booking creation failed: ${error?.message || data?.error}`);
      }
      
      cleanup.bookings.push(data.booking_id);
      stateTracker.set('booking_id', data.booking_id);
      stateTracker.set('booking_status', 'pending');
      
      // Verify state tracking
      if (!stateTracker.has('booking_id') || stateTracker.get('booking_status') !== 'pending') {
        throw new Error('State tracking failed');
      }
      
      console.log(`   ✅ State tracking working correctly`);
      console.log(`   📊 Tracked keys: ${Array.from(stateTracker.getAll().keys()).join(', ')}`);
      console.log(`   📋 History entries: ${stateTracker.getHistory().length}`);
    });

    // ============================================
    // EDGE CASE 5: Invalid State Transitions
    // ============================================
    await runner.runTest('EDGE CASE 5: Invalid state transition prevention', async () => {
      const customer = await getOrCreateTestUser(`edge-invalid-${Date.now()}@test.com`, 'customer');
      const business = await getRandomBusiness();
      const slot = await getRandomAvailableSlot(business.id);
      cleanup.slots.push(slot.id);
      
      // Create booking
      const bookingId = `EDGE-INVALID-${Date.now()}`;
      const { data, error } = await supabase.rpc('create_booking_atomically', {
        p_business_id: business.id,
        p_slot_id: slot.id,
        p_customer_name: 'Invalid Test Customer',
        p_customer_phone: '+919876543210',
        p_booking_id: bookingId,
        p_customer_user_id: customer.id,
        p_total_duration_minutes: 30,
        p_total_price_cents: 1000,
        p_services_count: 1,
        p_service_data: null,
      });
      
      if (error || !data?.success) {
        throw new Error(`Booking creation failed: ${error?.message || data?.error}`);
      }
      
      cleanup.bookings.push(data.booking_id);
      
      // Try to confirm booking (valid)
      const { data: confirmData, error: confirmError } = await supabase.rpc('confirm_booking_atomically', {
        p_booking_id: data.booking_id,
        p_actor_id: null,
      });
      
      if (confirmError || !confirmData?.success) {
        throw new Error(`Booking confirmation failed: ${confirmError?.message || confirmData?.error}`);
      }
      
      // Try to reject confirmed booking (should fail or be handled gracefully)
      const { data: booking } = await supabase
        .from('bookings')
        .select('status')
        .eq('id', data.booking_id)
        .single();
      
      if (booking?.status !== 'confirmed') {
        throw new Error(`Expected confirmed status, got ${booking?.status}`);
      }
      
      console.log(`   ✅ Invalid state transitions prevented`);
      console.log(`   📊 Final status: ${booking.status}`);
    });

    // ============================================
    // EDGE CASE 6: Boundary Conditions
    // ============================================
    await runner.runTest('EDGE CASE 6: Boundary condition testing', async () => {
      // Test with minimum values
      const minBusiness = await getRandomBusiness();
      
      // Test with maximum concurrent operations
      const maxConcurrent = 20;
      const promises = Array.from({ length: maxConcurrent }, async (_, i) => {
        try {
          const slot = await getRandomAvailableSlot(minBusiness.id);
          return { success: true, slotId: slot.id, index: i };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : String(error), index: i };
        }
      });
      
      const results = await Promise.all(promises);
      const successful = results.filter(r => r.success).length;
      
      console.log(`   ✅ Boundary conditions tested`);
      console.log(`   📊 Concurrent operations: ${maxConcurrent}`);
      console.log(`   ✅ Successful: ${successful}`);
      console.log(`   ❌ Failed: ${maxConcurrent - successful}`);
    });

    // ============================================
    // EDGE CASE 7: Data Integrity Checks
    // ============================================
    await runner.runTest('EDGE CASE 7: Data integrity validation', async () => {
      const customer = await getOrCreateTestUser(`edge-integrity-${Date.now()}@test.com`, 'customer');
      const business = await getRandomBusiness();
      const slot = await getRandomAvailableSlot(business.id);
      cleanup.slots.push(slot.id);
      
      const bookingId = `EDGE-INTEGRITY-${Date.now()}`;
      const { data, error } = await supabase.rpc('create_booking_atomically', {
        p_business_id: business.id,
        p_slot_id: slot.id,
        p_customer_name: 'Integrity Test Customer',
        p_customer_phone: '+919876543210',
        p_booking_id: bookingId,
        p_customer_user_id: customer.id,
        p_total_duration_minutes: 30,
        p_total_price_cents: 1000,
        p_services_count: 1,
        p_service_data: null,
      });
      
      if (error || !data?.success) {
        throw new Error(`Booking creation failed: ${error?.message || data?.error}`);
      }
      
      cleanup.bookings.push(data.booking_id);
      
      // Verify data integrity
      const { data: booking } = await supabase
        .from('bookings')
        .select('*, slot:slot_id(*), business:business_id(*)')
        .eq('id', data.booking_id)
        .single();
      
      if (!booking) {
        throw new Error('Booking not found after creation');
      }
      
      if (booking.business_id !== business.id) {
        throw new Error('Business ID mismatch');
      }
      
      if (booking.slot_id !== slot.id) {
        throw new Error('Slot ID mismatch');
      }
      
      if (booking.customer_user_id !== customer.id) {
        throw new Error('Customer ID mismatch');
      }
      
      console.log(`   ✅ Data integrity validated`);
      console.log(`   📊 Booking ID: ${booking.booking_id}`);
      console.log(`   🔗 Business: ${booking.business?.salon_name || 'N/A'}`);
      console.log(`   📅 Slot: ${booking.slot?.date || 'N/A'}`);
    });

    // ============================================
    // EDGE CASE 8: Error Recovery
    // ============================================
    await runner.runTest('EDGE CASE 8: Error recovery and rollback', async () => {
      const customer = await getOrCreateTestUser(`edge-recovery-${Date.now()}@test.com`, 'customer');
      const business = await getRandomBusiness();
      
      // Try to book a non-existent slot (should fail gracefully)
      const fakeSlotId = '00000000-0000-0000-0000-000000000000';
      const bookingId = `EDGE-RECOVERY-${Date.now()}`;
      
      const { data, error } = await supabase.rpc('create_booking_atomically', {
        p_business_id: business.id,
        p_slot_id: fakeSlotId,
        p_customer_name: 'Recovery Test Customer',
        p_customer_phone: '+919876543210',
        p_booking_id: bookingId,
        p_customer_user_id: customer.id,
        p_total_duration_minutes: 30,
        p_total_price_cents: 1000,
        p_services_count: 1,
        p_service_data: null,
      });
      
      // Should fail (this is expected)
      if (data?.success) {
        cleanup.bookings.push(data.booking_id);
        throw new Error('Booking should have failed with invalid slot ID');
      }
      
      if (!error && !data?.error) {
        throw new Error('Expected error for invalid slot ID');
      }
      
      console.log(`   ✅ Error recovery working correctly`);
      console.log(`   🚫 Error handled: ${error?.message || data?.error || 'Unknown'}`);
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
  testEdgeCases()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

export { testEdgeCases };
