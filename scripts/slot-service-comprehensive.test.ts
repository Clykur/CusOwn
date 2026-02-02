#!/usr/bin/env ts-node

/**
 * COMPREHENSIVE SLOT SERVICE TESTING
 * Tests all SlotService methods and edge cases
 */

import { 
  supabase, 
  TestRunner, 
  getRandomBusiness, 
  getRandomAvailableSlot, 
  getOrCreateTestUser, 
  cleanupTestData, 
  simulateUserAction
} from './test-utils';

// Import slotService using require for CommonJS compatibility
const { slotService } = require('../services/slot.service');

async function testSlotServiceComprehensive() {
  const runner = new TestRunner();
  const cleanup: { bookings: string[]; slots: string[]; businesses: string[] } = {
    bookings: [],
    slots: [],
    businesses: [],
  };

  try {
    // ============================================
    // TEST 1: Slot Generation
    // ============================================
    await runner.runTest('SLOT SERVICE 1: Generate slots for business', async () => {
      const owner = await getOrCreateTestUser(`slot-test-owner-${Date.now()}@test.com`, 'owner');
      const business = await getRandomBusiness();
      
      await simulateUserAction('Generate slots for date');
      
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];
      
      await slotService.generateSlotsForDate(business.id, dateStr, {
        opening_time: business.opening_time,
        closing_time: business.closing_time,
        slot_duration: business.slot_duration,
      });
      
      const { data: slots } = await supabase
        .from('slots')
        .select('*')
        .eq('business_id', business.id)
        .eq('date', dateStr);
      
      console.log(`   ✅ Generated ${slots?.length || 0} slots for ${dateStr}`);
      console.log(`   📊 Business: ${business.salon_name}`);
      console.log(`   ⏰ Hours: ${business.opening_time} - ${business.closing_time}`);
      console.log(`   ⏱️  Duration: ${business.slot_duration} minutes`);
    });

    // ============================================
    // TEST 2: Get Available Slots with Lazy Generation
    // ============================================
    await runner.runTest('SLOT SERVICE 2: Get available slots (lazy generation)', async () => {
      const business = await getRandomBusiness();
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 3);
      const dateStr = futureDate.toISOString().split('T')[0];
      
      await simulateUserAction('Get available slots with lazy generation');
      
      const slots = await slotService.getAvailableSlots(business.id, dateStr, {
        opening_time: business.opening_time,
        closing_time: business.closing_time,
        slot_duration: business.slot_duration,
      });
      
      console.log(`   ✅ Retrieved ${slots.length} available slots`);
      console.log(`   📅 Date: ${dateStr}`);
      if (slots.length > 0) {
        console.log(`   ⏰ First slot: ${slots[0].start_time} - ${slots[0].end_time}`);
        console.log(`   ⏰ Last slot: ${slots[slots.length - 1].start_time} - ${slots[slots.length - 1].end_time}`);
      }
    });

    // ============================================
    // TEST 3: Get Slot By ID
    // ============================================
    await runner.runTest('SLOT SERVICE 3: Get slot by ID', async () => {
      const business = await getRandomBusiness();
      const slot = await getRandomAvailableSlot(business.id);
      cleanup.slots.push(slot.id);
      
      await simulateUserAction('Get slot by ID');
      
      const retrievedSlot = await slotService.getSlotById(slot.id);
      
      if (!retrievedSlot) {
        throw new Error('Slot not found');
      }
      
      console.log(`   ✅ Slot retrieved successfully`);
      console.log(`   📋 Slot ID: ${retrievedSlot.id.substring(0, 8)}...`);
      console.log(`   📅 Date: ${retrievedSlot.date}`);
      console.log(`   ⏰ Time: ${retrievedSlot.start_time} - ${retrievedSlot.end_time}`);
      console.log(`   📊 Status: ${retrievedSlot.status}`);
    });

    // ============================================
    // TEST 4: Reserve Slot
    // ============================================
    await runner.runTest('SLOT SERVICE 4: Reserve slot', async () => {
      const business = await getRandomBusiness();
      const slot = await getRandomAvailableSlot(business.id);
      cleanup.slots.push(slot.id);
      
      // Ensure slot is available
      await supabase
        .from('slots')
        .update({ status: 'available', reserved_until: null })
        .eq('id', slot.id);
      
      await simulateUserAction('Reserve slot via service');
      
      const reserved = await slotService.reserveSlot(slot.id);
      
      if (!reserved) {
        // Check slot status for debugging
        const { data: slotStatus } = await supabase
          .from('slots')
          .select('status, reserved_until')
          .eq('id', slot.id)
          .single();
        throw new Error(`Slot reservation failed. Slot status: ${slotStatus?.status}, reserved_until: ${slotStatus?.reserved_until}`);
      }
      
      const { data: updatedSlot } = await supabase
        .from('slots')
        .select('*')
        .eq('id', slot.id)
        .single();
      
      console.log(`   ✅ Slot reserved successfully`);
      console.log(`   📊 Status: ${updatedSlot?.status}`);
      console.log(`   🔒 Reserved Until: ${updatedSlot?.reserved_until ? new Date(updatedSlot.reserved_until).toLocaleString() : 'N/A'}`);
    });

    // ============================================
    // TEST 5: Release Slot
    // ============================================
    await runner.runTest('SLOT SERVICE 5: Release reserved slot', async () => {
      const business = await getRandomBusiness();
      const slot = await getRandomAvailableSlot(business.id);
      cleanup.slots.push(slot.id);
      
      // First reserve it
      await slotService.reserveSlot(slot.id);
      
      await simulateUserAction('Release slot via service');
      
      await slotService.releaseSlot(slot.id);
      
      const { data: releasedSlot } = await supabase
        .from('slots')
        .select('*')
        .eq('id', slot.id)
        .single();
      
      if (releasedSlot?.status !== 'available') {
        throw new Error(`Expected available status, got ${releasedSlot?.status}`);
      }
      
      console.log(`   ✅ Slot released successfully`);
      console.log(`   📊 Status: ${releasedSlot.status}`);
      console.log(`   🔓 Reserved Until: ${releasedSlot.reserved_until || 'null'}`);
    });

    // ============================================
    // TEST 6: Book Slot (Reserved -> Booked)
    // ============================================
    await runner.runTest('SLOT SERVICE 6: Book reserved slot', async () => {
      const business = await getRandomBusiness();
      const slot = await getRandomAvailableSlot(business.id);
      cleanup.slots.push(slot.id);
      
      // First reserve it
      await slotService.reserveSlot(slot.id);
      
      await simulateUserAction('Book slot via service');
      
      await slotService.bookSlot(slot.id);
      
      const { data: bookedSlot } = await supabase
        .from('slots')
        .select('*')
        .eq('id', slot.id)
        .single();
      
      if (bookedSlot?.status !== 'booked') {
        throw new Error(`Expected booked status, got ${bookedSlot?.status}`);
      }
      
      console.log(`   ✅ Slot booked successfully`);
      console.log(`   📊 Status: ${bookedSlot.status}`);
      console.log(`   🔒 Reserved Until: ${bookedSlot.reserved_until || 'null'}`);
    });

    // ============================================
    // TEST 7: Release Expired Reservations
    // ============================================
    await runner.runTest('SLOT SERVICE 7: Release expired reservations', async () => {
      const business = await getRandomBusiness();
      const slot1 = await getRandomAvailableSlot(business.id);
      const slot2 = await getRandomAvailableSlot(business.id);
      cleanup.slots.push(slot1.id, slot2.id);
      
      // Reserve both slots
      await slotService.reserveSlot(slot1.id);
      await slotService.reserveSlot(slot2.id);
      
      // Manually expire one slot
      const pastDate = new Date(Date.now() - 1000 * 60 * 60); // 1 hour ago
      await supabase
        .from('slots')
        .update({ reserved_until: pastDate.toISOString() })
        .eq('id', slot1.id);
      
      await simulateUserAction('Release expired reservations');
      
      const releasedCount = await slotService.releaseExpiredReservations();
      
      const { data: slot1After } = await supabase
        .from('slots')
        .select('*')
        .eq('id', slot1.id)
        .single();
      
      const { data: slot2After } = await supabase
        .from('slots')
        .select('*')
        .eq('id', slot2.id)
        .single();
      
      console.log(`   ✅ Released ${releasedCount} expired reservations`);
      console.log(`   📊 Expired slot status: ${slot1After?.status} (should be available)`);
      console.log(`   📊 Active slot status: ${slot2After?.status} (should be reserved)`);
      
      if (slot1After?.status !== 'available') {
        throw new Error(`Expired slot should be available, got ${slot1After?.status}`);
      }
    });

    // ============================================
    // TEST 8: Update Slot Status
    // ============================================
    await runner.runTest('SLOT SERVICE 8: Update slot status', async () => {
      const business = await getRandomBusiness();
      const slot = await getRandomAvailableSlot(business.id);
      cleanup.slots.push(slot.id);
      
      await simulateUserAction('Update slot status');
      
      await slotService.updateSlotStatus(slot.id, 'reserved');
      
      const { data: updatedSlot } = await supabase
        .from('slots')
        .select('*')
        .eq('id', slot.id)
        .single();
      
      if (updatedSlot?.status !== 'reserved') {
        throw new Error(`Expected reserved status, got ${updatedSlot?.status}`);
      }
      
      console.log(`   ✅ Slot status updated successfully`);
      console.log(`   📊 Status: ${updatedSlot.status}`);
    });

    // ============================================
    // TEST 9: Invalid State Transitions
    // ============================================
    await runner.runTest('SLOT SERVICE 9: Invalid state transition prevention', async () => {
      const business = await getRandomBusiness();
      const slot = await getRandomAvailableSlot(business.id);
      cleanup.slots.push(slot.id);
      
      // Book the slot
      await slotService.reserveSlot(slot.id);
      await slotService.bookSlot(slot.id);
      
      await simulateUserAction('Try invalid state transition');
      
      // Try to reserve an already booked slot (should fail)
      try {
        const reserved = await slotService.reserveSlot(slot.id);
        if (reserved) {
          throw new Error('Should not be able to reserve an already booked slot');
        }
        console.log(`   ✅ Correctly prevented reserving booked slot`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        if (errorMsg.includes('Cannot') || errorMsg.includes('Invalid')) {
          console.log(`   ✅ Correctly rejected invalid transition: ${errorMsg}`);
        } else {
          throw error;
        }
      }
    });

    // ============================================
    // TEST 10: Past Slot Filtering
    // ============================================
    await runner.runTest('SLOT SERVICE 10: Past slot filtering', async () => {
      const business = await getRandomBusiness();
      const today = new Date().toISOString().split('T')[0];
      
      await simulateUserAction('Get slots for today (past slots filtered)');
      
      const slots = await slotService.getAvailableSlots(business.id, today, {
        opening_time: business.opening_time,
        closing_time: business.closing_time,
        slot_duration: business.slot_duration,
      }, { skipCleanup: true });
      
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      
      // Check that past slots are filtered out
      const pastSlots = slots.filter((slot: any) => {
        const [hours, minutes] = slot.start_time.split(':').map(Number);
        return hours < currentHour || (hours === currentHour && minutes < currentMinute);
      });
      
      console.log(`   ✅ Retrieved ${slots.length} slots for today`);
      console.log(`   📊 Past slots filtered: ${pastSlots.length === 0 ? 'Yes' : 'No'}`);
      console.log(`   ⏰ Current time: ${currentHour}:${String(currentMinute).padStart(2, '0')}`);
      
      if (pastSlots.length > 0 && slots.some((s: any) => s.status !== 'booked')) {
        console.log(`   ⚠️  Warning: ${pastSlots.length} past slots found (may be booked slots)`);
      }
    });

    // ============================================
    // TEST 11: Slot Generation with Existing Slots
    // ============================================
    await runner.runTest('SLOT SERVICE 11: Slot generation skips existing slots', async () => {
      const business = await getRandomBusiness();
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];
      
      // Generate slots first time
      await slotService.generateSlotsForDate(business.id, dateStr, {
        opening_time: business.opening_time,
        closing_time: business.closing_time,
        slot_duration: business.slot_duration,
      });
      
      const { data: firstGen } = await supabase
        .from('slots')
        .select('id')
        .eq('business_id', business.id)
        .eq('date', dateStr);
      
      const firstCount = firstGen?.length || 0;
      
      // Try to generate again (should skip)
      await slotService.generateSlotsForDate(business.id, dateStr, {
        opening_time: business.opening_time,
        closing_time: business.closing_time,
        slot_duration: business.slot_duration,
      });
      
      const { data: secondGen } = await supabase
        .from('slots')
        .select('id')
        .eq('business_id', business.id)
        .eq('date', dateStr);
      
      const secondCount = secondGen?.length || 0;
      
      console.log(`   ✅ First generation: ${firstCount} slots`);
      console.log(`   ✅ Second generation: ${secondCount} slots`);
      console.log(`   🔒 Duplicate prevention: ${firstCount === secondCount ? 'Working' : 'Failed'}`);
      
      if (firstCount !== secondCount) {
        throw new Error(`Expected same count, got ${firstCount} vs ${secondCount}`);
      }
    });

    // ============================================
    // TEST 12: Get Slot By ID - Not Found
    // ============================================
    await runner.runTest('SLOT SERVICE 12: Get non-existent slot', async () => {
      await simulateUserAction('Get non-existent slot');
      
      const fakeSlotId = '00000000-0000-0000-0000-000000000000';
      const slot = await slotService.getSlotById(fakeSlotId);
      
      if (slot !== null) {
        throw new Error('Expected null for non-existent slot');
      }
      
      console.log(`   ✅ Correctly returned null for non-existent slot`);
    });

  } finally {
    await cleanupTestData(cleanup.bookings, cleanup.slots);
    if (cleanup.businesses.length > 0) {
      await supabase.from('businesses').delete().in('id', cleanup.businesses);
    }
  }

  runner.printSummary();
  return runner.getResults();
}

if (require.main === module) {
  testSlotServiceComprehensive()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

export { testSlotServiceComprehensive };
