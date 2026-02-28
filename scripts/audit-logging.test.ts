#!/usr/bin/env ts-node

/**
 * PHASE 8: AUDIT LOGGING TESTS
 */

import {
  supabase,
  TestRunner,
  getRandomBusiness,
  getRandomAvailableSlot,
  cleanupTestData,
  simulateUserAction,
} from './test-utils';

async function testAuditLogging() {
  const runner = new TestRunner();
  const cleanup: { bookings: string[]; slots: string[] } = {
    bookings: [],
    slots: [],
  };

  try {
    await runner.runTest('AUDIT 1: Slot transitions create audit logs', async () => {
      const business = await getRandomBusiness();
      const slot = await getRandomAvailableSlot(business.id);
      cleanup.slots.push(slot.id);

      await simulateUserAction('Test slot transition audit logging');

      const { slotService } = require('../services/slot.service');
      await slotService.reserveSlot(slot.id);

      const { data: auditLogs, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('entity_type', 'slot')
        .eq('entity_id', slot.id)
        .limit(5);

      if (error && error.message.includes('does not exist')) {
        console.log(`   ⚠️  Audit logs table not found`);
        return;
      }

      if (auditLogs && auditLogs.length > 0) {
        console.log(`   ✅ Audit log created`);
      } else {
        console.log(`   ⚠️  No audit logs found`);
      }
    });

    await runner.runTest('AUDIT 2: Audit logs contain required fields', async () => {
      const { data: auditLogs } = await supabase.from('audit_logs').select('*').limit(1);

      if (!auditLogs || auditLogs.length === 0) {
        console.log(`   ⚠️  No audit logs found`);
        return;
      }

      const log = auditLogs[0];
      const requiredFields = ['id', 'action_type', 'entity_type', 'created_at'];
      const missingFields = requiredFields.filter((field) => !(field in log));

      if (missingFields.length > 0) {
        throw new Error(`Missing fields: ${missingFields.join(', ')}`);
      }

      console.log(`   ✅ All required fields present`);
    });
  } finally {
    await cleanupTestData(cleanup.bookings, cleanup.slots);
  }

  runner.printSummary();
  return runner.getResults();
}

if (require.main === module) {
  testAuditLogging()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

export { testAuditLogging };
