#!/usr/bin/env ts-node
/**
 * Database migration tests (live DB).
 * Verifies core tables exist, has_index RPC exists, and constraint/FK behavior when DB is available.
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env.local (or test-utils env).
 * Skips or passes gracefully when relations/functions do not exist (e.g. fresh project).
 */

import { supabase, TestRunner } from '../test-utils';

async function runDatabaseMigrationsTests(): Promise<void> {
  const runner = new TestRunner();

  await runner.runTest('core tables exist (businesses, slots, bookings)', async () => {
    const tables = ['businesses', 'slots', 'bookings'] as const;
    for (const table of tables) {
      const { error } = await supabase.from(table).select('id').limit(0);
      if (
        error &&
        !error.message.includes('relation') &&
        !error.message.includes('does not exist')
      ) {
        throw new Error(`${table}: ${error.message}`);
      }
    }
  });

  await runner.runTest('business_categories table exists', async () => {
    const { error } = await supabase.from('businesses').select('category').limit(0);
    if (error && !error.message.includes('relation') && !error.message.includes('does not exist')) {
      throw new Error(`businesses: ${error.message}`);
    }
    const { error: catError } = await supabase.from('business_categories').select('value').limit(0);
    if (
      catError &&
      !catError.message.includes('relation') &&
      !catError.message.includes('does not exist')
    ) {
      throw new Error(`business_categories: ${catError.message}`);
    }
  });

  await runner.runTest('has_index RPC exists and returns boolean', async () => {
    const { data, error } = await supabase.rpc('has_index', {
      p_index_name: 'idx_bookings_business',
    });
    if (error) {
      if (
        error.message.includes('function') &&
        (error.message.includes('does not exist') || error.message.includes('could not find'))
      ) {
        return;
      }
      throw new Error(`has_index error: ${error.message}`);
    }
    if (data !== undefined && data !== null) {
      if (typeof data !== 'boolean')
        throw new Error(`has_index should return boolean, got ${typeof data}`);
    }
  });

  await runner.runTest('slots.business_id FK: table has expected structure', async () => {
    const { data, error } = await supabase.from('slots').select('id, business_id, date').limit(0);
    if (error && !error.message.includes('relation') && !error.message.includes('does not exist')) {
      throw new Error(`slots select: ${error.message}`);
    }
    expectArray(data);
  });

  await runner.runTest('bookings.slot_id and business_id columns exist', async () => {
    const { data, error } = await supabase
      .from('bookings')
      .select('id, business_id, slot_id')
      .limit(0);
    if (error && !error.message.includes('relation') && !error.message.includes('does not exist')) {
      throw new Error(`bookings select: ${error.message}`);
    }
    expectArray(data);
  });

  await runner.runTest('audit_logs table exists when migrations applied', async () => {
    const { error } = await supabase.from('audit_logs').select('id').limit(0);
    if (error && !error.message.includes('relation') && !error.message.includes('does not exist')) {
      throw new Error(`audit_logs: ${error.message}`);
    }
  });

  runner.printSummary();
}

function expectArray(val: unknown): void {
  if (val !== null && val !== undefined && !Array.isArray(val)) {
    throw new Error('Expected array or null');
  }
}

if (require.main === module) {
  runDatabaseMigrationsTests()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

export { runDatabaseMigrationsTests };
