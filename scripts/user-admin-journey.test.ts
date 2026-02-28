#!/usr/bin/env ts-node
import {
  supabase,
  TestRunner,
  getOrCreateTestUser,
  getRandomBusiness,
  simulateUserAction,
} from './test-utils';
async function testAdminJourney() {
  const runner = new TestRunner();
  let admin: any = null;
  try {
    await runner.runTest('STEP 1: Admin logs in', async () => {
      admin = await getOrCreateTestUser(`test-admin-${Date.now()}@test.com`, 'owner');
      await supabase.from('user_profiles').update({ user_type: 'admin' }).eq('id', admin.id);
      await simulateUserAction('Admin logs in', { email: admin.email });
      console.log(`   Admin ID: ${admin.id.substring(0, 8)}...`);
    });
    await runner.runTest('STEP 2: Admin views dashboard', async () => {
      await simulateUserAction('Admin views dashboard');
      const { data: businesses } = await supabase
        .from('businesses')
        .select('id')
        .eq('suspended', false);
      const { data: bookings } = await supabase.from('bookings').select('id');
      console.log(`   Active businesses: ${businesses?.length || 0}`);
      console.log(`   Total bookings: ${bookings?.length || 0}`);
    });
    await runner.runTest('STEP 3: Admin views all businesses', async () => {
      await simulateUserAction('Admin views businesses');
      const { data, error } = await supabase
        .from('businesses')
        .select('id, salon_name, suspended')
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw new Error(`Failed to fetch businesses: ${error.message}`);
      console.log(`   Found ${data?.length || 0} businesses`);
    });
  } finally {
    if (admin)
      await supabase.from('user_profiles').update({ user_type: 'owner' }).eq('id', admin.id);
  }
  runner.printSummary();
  return runner.getResults();
}
if (require.main === module) {
  testAdminJourney()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}
export { testAdminJourney };
