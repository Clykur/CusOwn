#!/usr/bin/env ts-node
import { supabase, TestRunner, getRandomBusiness, getRandomAvailableSlot, cleanupTestData, simulateUserAction } from './test-utils';
async function testSlotManagement() {
  const runner = new TestRunner();
  const cleanup: { bookings: string[]; slots: string[] } = { bookings: [], slots: [] };
  try {
    await runner.runTest('STEP 1: User views available slots', async () => {
      const business = await getRandomBusiness();
      await simulateUserAction('User views available slots');
      
      // Try multiple dates (BFS approach)
      const dates: string[] = [];
      for (let i = 1; i <= 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        dates.push(date.toISOString().split('T')[0]);
      }
      
      let slotsFound = false;
      for (const dateStr of dates) {
        const { data, error } = await supabase
          .from('slots')
          .select('*')
          .eq('business_id', business.id)
          .eq('status', 'available')
          .eq('date', dateStr)
          .order('start_time', { ascending: true })
          .limit(10);
        
        if (!error && data && data.length > 0) {
          console.log(`   Found ${data.length} available slots for ${dateStr}`);
          slotsFound = true;
          (global as any).testBusiness = business;
          (global as any).testDate = dateStr;
          break;
        }
      }
      
      if (!slotsFound) {
        throw new Error('No available slots found in next 7 days');
      }
    });
    await runner.runTest('STEP 2: User reserves a slot', async () => {
      const slot = await getRandomAvailableSlot((global as any).testBusiness.id);
      cleanup.slots.push(slot.id);
      await simulateUserAction('User reserves slot');
      const reservedUntil = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const { error } = await supabase.from('slots').update({ status: 'reserved', reserved_until: reservedUntil }).eq('id', slot.id).eq('status', 'available');
      if (error) throw new Error(`Failed to reserve slot: ${error.message}`);
      
      const { data: reservedSlot } = await supabase.from('slots').select('*').eq('id', slot.id).single();
      
      console.log(`   ✅ Slot reserved successfully`);
      console.log(`   📋 Slot ID: ${slot.id.substring(0, 8)}...`);
      console.log(`   📅 Date: ${slot.date}`);
      console.log(`   ⏰ Time: ${slot.start_time} - ${slot.end_time}`);
      console.log(`   🔒 Reserved Until: ${new Date(reservedUntil).toLocaleString()}`);
      console.log(`   📊 Status: ${reservedSlot?.status || 'reserved'}`);
    });
  } finally {
    await cleanupTestData(cleanup.bookings, cleanup.slots);
  }
  runner.printSummary();
  return runner.getResults();
}
if (require.main === module) {
  testSlotManagement().then(() => process.exit(0)).catch((error) => { console.error('Test failed:', error); process.exit(1); });
}
export { testSlotManagement };
