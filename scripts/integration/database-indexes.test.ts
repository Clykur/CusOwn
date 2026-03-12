#!/usr/bin/env ts-node

import { supabase, TestRunner } from '../test-utils';

async function runDatabaseIndexesTests(): Promise<void> {
  const runner = new TestRunner();

  await runner.runTest('booking indexes exist and basic queries succeed', async () => {
    const bookingIndexes = [
      'idx_bookings_customer_user_id_created_at',
      'idx_bookings_slot_id',
      'idx_bookings_status_created_at',
    ];

    for (const indexName of bookingIndexes) {
      const { data, error } = await supabase.rpc('has_index', { p_index_name: indexName });
      if (error) {
        throw new Error(`has_index error for ${indexName}: ${error.message}`);
      }
      if (!data) {
        throw new Error(`Expected index not found: ${indexName}`);
      }
    }

    const { error: q1Error } = await supabase
      .from('bookings')
      .select('id')
      .eq('customer_user_id', '00000000-0000-0000-0000-000000000000')
      .order('created_at', { ascending: false })
      .limit(1);
    if (q1Error && !q1Error.message.includes('relation "bookings" does not exist')) {
      throw q1Error;
    }

    const { error: q2Error } = await supabase
      .from('bookings')
      .select('id')
      .eq('slot_id', '00000000-0000-0000-0000-000000000000')
      .limit(1);
    if (q2Error && !q2Error.message.includes('relation "bookings" does not exist')) {
      throw q2Error;
    }
  });

  await runner.runTest('discovery indexes exist and discovery query succeeds', async () => {
    const discoveryIndexes = [
      'idx_businesses_city_area_pincode_active',
      'idx_businesses_created_at',
    ];

    for (const indexName of discoveryIndexes) {
      const { data, error } = await supabase.rpc('has_index', { p_index_name: indexName });
      if (error) {
        throw new Error(`has_index error for ${indexName}: ${error.message}`);
      }
      if (!data) {
        throw new Error(`Expected index not found: ${indexName}`);
      }
    }

    const { error } = await supabase.rpc('search_businesses_ranked', {
      p_lat: null,
      p_lng: null,
      p_radius_km: 10,
      p_city: null,
      p_area: null,
      p_pincode: null,
      p_category: null,
      p_available_today: false,
      p_min_rating: null,
      p_limit: 1,
      p_offset: 0,
    });

    if (error && !error.message.includes('function public.search_businesses_ranked')) {
      throw error;
    }
  });

  await runner.runTest('audit log indexes exist and basic queries succeed', async () => {
    const auditIndexes = [
      'idx_audit_logs_entity_type_entity_id_created_at',
      'idx_audit_logs_admin_user_id_created_at',
      'idx_audit_logs_severity_created_at',
    ];

    for (const indexName of auditIndexes) {
      const { data, error } = await supabase.rpc('has_index', { p_index_name: indexName });
      if (error) {
        throw new Error(`has_index error for ${indexName}: ${error.message}`);
      }
      if (!data) {
        throw new Error(`Expected index not found: ${indexName}`);
      }
    }

    const { error: q1Error } = await supabase
      .from('audit_logs')
      .select('id')
      .eq('entity_type', 'booking')
      .limit(1);
    if (q1Error && !q1Error.message.includes('relation "audit_logs" does not exist')) {
      throw q1Error;
    }

    const { error: q2Error } = await supabase
      .from('audit_logs')
      .select('id')
      .eq('admin_user_id', '00000000-0000-0000-0000-000000000000')
      .order('created_at', { ascending: false })
      .limit(1);
    if (q2Error && !q2Error.message.includes('relation "audit_logs" does not exist')) {
      throw q2Error;
    }
  });

  await runner.runTest(
    'booking partial indexes exist and active-booking queries succeed',
    async () => {
      const partialIndexes = [
        'idx_bookings_partial_pending_confirmed_user_created',
        'idx_bookings_partial_pending_confirmed_slot',
        'idx_bookings_partial_pending_confirmed_business_created',
      ];
      for (const indexName of partialIndexes) {
        const { data, error } = await supabase.rpc('has_index', { p_index_name: indexName });
        if (error) throw new Error(`has_index error for ${indexName}: ${error.message}`);
        if (!data) throw new Error(`Expected index not found: ${indexName}`);
      }
      const { error: qErr } = await supabase
        .from('bookings')
        .select('id')
        .in('status', ['pending', 'confirmed'])
        .eq('business_id', '00000000-0000-0000-0000-000000000000')
        .order('created_at', { ascending: false })
        .limit(5);
      if (qErr && !qErr.message.includes('relation "bookings" does not exist')) throw qErr;
    }
  );

  await runner.runTest(
    'discovery partial indexes exist and active-business queries succeed',
    async () => {
      const partialIndexes = [
        'idx_businesses_partial_active_category',
        'idx_businesses_partial_active_city_area',
        'idx_businesses_partial_active_pincode',
      ];
      for (const indexName of partialIndexes) {
        const { data, error } = await supabase.rpc('has_index', { p_index_name: indexName });
        if (error) throw new Error(`has_index error for ${indexName}: ${error.message}`);
        if (!data) throw new Error(`Expected index not found: ${indexName}`);
      }
      const { error: qErr } = await supabase
        .from('businesses')
        .select('id')
        .eq('suspended', false)
        .is('deleted_at', null)
        .eq('category', 'salon')
        .limit(5);
      if (qErr && !qErr.message.includes('relation "businesses" does not exist')) throw qErr;
    }
  );

  await runner.runTest(
    'audit log partial indexes exist and time-range queries succeed',
    async () => {
      const partialIndexes = [
        'idx_audit_logs_partial_recent_created_at',
        'idx_audit_logs_partial_recent_entity_type',
        'idx_audit_logs_partial_recent_admin_user',
        'idx_audit_logs_partial_recent_severity',
      ];
      for (const indexName of partialIndexes) {
        const { data, error } = await supabase.rpc('has_index', { p_index_name: indexName });
        if (error) throw new Error(`has_index error for ${indexName}: ${error.message}`);
        if (!data) throw new Error(`Expected index not found: ${indexName}`);
      }
      const { error: qErr } = await supabase
        .from('audit_logs')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(10);
      if (qErr && !qErr.message.includes('relation "audit_logs" does not exist')) throw qErr;
    }
  );

  await runner.runTest('booking covering indexes exist', async () => {
    const coveringIndexes = [
      'idx_bookings_covering_business_list',
      'idx_bookings_covering_customer_list',
      'idx_bookings_covering_status_list',
    ];
    for (const indexName of coveringIndexes) {
      const { data, error } = await supabase.rpc('has_index', { p_index_name: indexName });
      if (error) throw new Error(`has_index error for ${indexName}: ${error.message}`);
      if (!data) throw new Error(`Expected index not found: ${indexName}`);
    }
  });

  await runner.runTest('discovery covering indexes exist', async () => {
    const coveringIndexes = [
      'idx_businesses_covering_discovery_category',
      'idx_businesses_covering_discovery_city',
      'idx_businesses_covering_discovery_pincode',
    ];
    for (const indexName of coveringIndexes) {
      const { data, error } = await supabase.rpc('has_index', { p_index_name: indexName });
      if (error) throw new Error(`has_index error for ${indexName}: ${error.message}`);
      if (!data) throw new Error(`Expected index not found: ${indexName}`);
    }
  });

  await runner.runTest('audit log covering indexes exist', async () => {
    const coveringIndexes = [
      'idx_audit_logs_covering_admin_dashboard',
      'idx_audit_logs_covering_entity_type',
      'idx_audit_logs_covering_severity',
    ];
    for (const indexName of coveringIndexes) {
      const { data, error } = await supabase.rpc('has_index', { p_index_name: indexName });
      if (error) throw new Error(`has_index error for ${indexName}: ${error.message}`);
      if (!data) throw new Error(`Expected index not found: ${indexName}`);
    }
  });

  runner.printSummary();
}

if (require.main === module) {
  runDatabaseIndexesTests()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('database-indexes.test.ts failed:', error);
      process.exit(1);
    });
}

export { runDatabaseIndexesTests };
