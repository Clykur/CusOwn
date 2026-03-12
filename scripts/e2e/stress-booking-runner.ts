#!/usr/bin/env ts-node

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import os from 'os';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  STRESS_TEST_DEFAULT_CONCURRENT_USERS,
  STRESS_TEST_DEFAULT_DURATION_SEC,
  STRESS_TEST_DEFAULT_REQUESTS_PER_SEC,
  STRESS_TEST_DEFAULT_MIN_BUSINESSES,
  STRESS_TEST_DEFAULT_MIN_SLOTS,
  STRESS_TEST_LOG_INTERVAL_MS,
  STRESS_MONITOR_INTERVAL_MS,
  STRESS_EVENT_LOOP_LAG_THRESHOLD_MS,
  STRESS_CPU_LIMIT_PCT,
  STRESS_CPU_SUSTAINED_SAMPLES,
  STRESS_POOL_EXHAUSTION_PCT,
  BOOKING_STATUS,
  SLOT_STATUS,
  BOOKING_IDEMPOTENCY_HEADER,
} from '@/config/constants';

const NODE_ENV = process.env.NODE_ENV || 'development';
const ALLOW_STRESS_TEST =
  process.env.STRESS_TEST_ALLOWED === 'true' || process.env.STRESS_TEST_ALLOWED === '1';

if (NODE_ENV === 'production' && !ALLOW_STRESS_TEST) {
  console.error('Stress test is not allowed in production. Set STRESS_TEST_ALLOWED=1 to override.');
  process.exit(1);
}

const CONCURRENT_USERS = parseInt(
  process.env.STRESS_CONCURRENT_USERS ?? String(STRESS_TEST_DEFAULT_CONCURRENT_USERS),
  10
);
const DURATION_SEC = parseInt(
  process.env.STRESS_DURATION_SEC ?? String(STRESS_TEST_DEFAULT_DURATION_SEC),
  10
);
const REQUESTS_PER_SEC = parseInt(
  process.env.STRESS_REQUESTS_PER_SEC ?? String(STRESS_TEST_DEFAULT_REQUESTS_PER_SEC),
  10
);
const MIN_BUSINESSES = parseInt(
  process.env.STRESS_MIN_BUSINESSES ?? String(STRESS_TEST_DEFAULT_MIN_BUSINESSES),
  10
);
const MIN_SLOTS = parseInt(
  process.env.STRESS_MIN_SLOTS ?? String(STRESS_TEST_DEFAULT_MIN_SLOTS),
  10
);
const MONITOR_INTERVAL_MS = parseInt(
  process.env.STRESS_MONITOR_INTERVAL_MS ?? String(STRESS_MONITOR_INTERVAL_MS),
  10
);
const EVENT_LOOP_LAG_THRESHOLD_MS = parseInt(
  process.env.STRESS_EVENT_LOOP_LAG_THRESHOLD_MS ?? String(STRESS_EVENT_LOOP_LAG_THRESHOLD_MS),
  10
);
const CPU_LIMIT_PCT = parseInt(
  process.env.STRESS_CPU_LIMIT_PCT ?? String(STRESS_CPU_LIMIT_PCT),
  10
);
const POOL_EXHAUSTION_PCT = parseInt(
  process.env.STRESS_POOL_EXHAUSTION_PCT ?? String(STRESS_POOL_EXHAUSTION_PCT),
  10
);
const BASE_URL = (
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.STRESS_BASE_URL ||
  'http://localhost:3000'
).replace(/\/$/, '');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type AbortFlag = { aborted: boolean };

type DbPoolStats = {
  active: number;
  idle: number;
  waiting: number;
  max_connections: number;
  pool_usage_pct: number;
};

async function getConnectionPoolStats(): Promise<DbPoolStats | null> {
  try {
    const { data, error } = await supabase.rpc('get_connection_pool_stats');
    if (error || data == null) return null;
    const raw = typeof data === 'string' ? JSON.parse(data) : data;
    const active = Number(raw.active) || 0;
    const idle = Number(raw.idle) || 0;
    const waiting = Number(raw.waiting) || 0;
    const maxConn = Number(raw.max_connections) || 1;
    const poolUsagePct = maxConn > 0 ? ((active + idle) / maxConn) * 100 : 0;
    return { active, idle, waiting, max_connections: maxConn, pool_usage_pct: poolUsagePct };
  } catch {
    return null;
  }
}

function measureEventLoopLag(): Promise<number> {
  return new Promise((resolve) => {
    const t0 = process.hrtime.bigint();
    setImmediate(() => {
      const lagMs = Number(process.hrtime.bigint() - t0) / 1e6;
      resolve(lagMs);
    });
  });
}

function getEventLoopUtilization(): number | null {
  try {
    const perf = require('perf_hooks').performance;
    if (typeof perf.eventLoopUtilization === 'function') {
      const u = perf.eventLoopUtilization();
      return typeof u.utilization === 'number' ? u.utilization : null;
    }
  } catch {}
  return null;
}

type SlotTarget = { businessId: string; slotId: string; salonName: string };

async function loadSlotPool(): Promise<SlotTarget[]> {
  const { data: businesses } = await supabase
    .from('businesses')
    .select('id, salon_name')
    .eq('suspended', false)
    .limit(Math.max(MIN_BUSINESSES, 10));

  if (!businesses?.length) {
    throw new Error('No active businesses for stress test');
  }

  const pool: SlotTarget[] = [];
  for (const b of businesses) {
    const { data: slots } = await supabase
      .from('slots')
      .select('id')
      .eq('business_id', b.id)
      .eq('status', 'available')
      .limit(Math.max(20, MIN_SLOTS));

    if (slots?.length) {
      for (const s of slots) {
        pool.push({ businessId: b.id, slotId: s.id, salonName: b.salon_name });
      }
    }
  }

  if (pool.length < MIN_SLOTS) {
    throw new Error(`Not enough available slots (need at least ${MIN_SLOTS}, got ${pool.length})`);
  }
  return pool;
}

function pickSlot(pool: SlotTarget[]): SlotTarget {
  return pool[Math.floor(Math.random() * pool.length)];
}

type StressStats = {
  requestCount: number;
  successCount: number;
  failureCount: number;
  conflictCount: number;
  latencies: number[];
  memorySamples: number[];
  eventLoopLagSamples: number[];
  peakCpuPct: number;
  peakDbConnections: number;
  dbPoolExhausted: boolean;
  eventLoopLagExceeded: boolean;
  sustainedCpuExceeded: boolean;
  lastCpuUsage: ReturnType<typeof process.cpuUsage>;
  lastCpuTime: number;
  consecutiveHighCpu: number;
};

async function runStress(
  slotPool: SlotTarget[],
  abortSignal: AbortFlag,
  stats: StressStats
): Promise<void> {
  const delayMs = REQUESTS_PER_SEC > 0 ? (1000 * CONCURRENT_USERS) / REQUESTS_PER_SEC : 0;
  const startTime = Date.now();
  const endTime = startTime + DURATION_SEC * 1000;
  stats.lastCpuUsage = process.cpuUsage();
  stats.lastCpuTime = startTime;

  const worker = async (workerId: number) => {
    while (!abortSignal.aborted && Date.now() < endTime) {
      if (delayMs > 0) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
      if (abortSignal.aborted) break;

      const slot = pickSlot(slotPool);
      const idempotencyKey = crypto.randomUUID();
      const t0 = Date.now();
      let status = 0;
      try {
        const timeoutController = new AbortController();
        const timeoutId = setTimeout(() => timeoutController.abort(), 30000);
        const res = await fetch(`${BASE_URL}/api/bookings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            [BOOKING_IDEMPOTENCY_HEADER]: idempotencyKey,
            'x-request-id': crypto.randomUUID(),
          },
          body: JSON.stringify({
            salon_id: slot.businessId,
            slot_id: slot.slotId,
            customer_name: `Stress User ${workerId}`,
            customer_phone: '+919876543210',
          }),
          signal: timeoutController.signal,
        });
        clearTimeout(timeoutId);
        status = res.status;
        const latency = Date.now() - t0;
        stats.requestCount++;
        stats.latencies.push(latency);
        if (res.ok) {
          stats.successCount++;
        } else {
          stats.failureCount++;
          if (status === 409) stats.conflictCount++;
        }
      } catch {
        stats.requestCount++;
        stats.failureCount++;
        stats.latencies.push(Date.now() - t0);
      }
    }
  };

  const workers = Array.from({ length: CONCURRENT_USERS }, (_, i) => worker(i));
  const logInterval = setInterval(async () => {
    if (abortSignal.aborted) return;
    const now = Date.now();
    const elapsed = (now - startTime) / 1000;
    const rps = stats.requestCount / elapsed || 0;
    const successRate = stats.requestCount ? (stats.successCount / stats.requestCount) * 100 : 0;
    const failRate = stats.requestCount ? (stats.failureCount / stats.requestCount) * 100 : 0;
    const avgLatency =
      stats.latencies.length > 0
        ? stats.latencies.reduce((a, b) => a + b, 0) / stats.latencies.length
        : 0;
    const peakLatency = stats.latencies.length > 0 ? Math.max(...stats.latencies) : 0;
    const heapMb = process.memoryUsage().heapUsed / 1024 / 1024;
    stats.memorySamples.push(process.memoryUsage().heapUsed);

    const lagMs = await measureEventLoopLag();
    stats.eventLoopLagSamples.push(lagMs);
    if (lagMs > EVENT_LOOP_LAG_THRESHOLD_MS) stats.eventLoopLagExceeded = true;

    const cpuElapsedSec = (now - stats.lastCpuTime) / 1000;
    const cpuDelta = process.cpuUsage(stats.lastCpuUsage);
    stats.lastCpuUsage = process.cpuUsage();
    stats.lastCpuTime = now;
    const cpuUtil = cpuElapsedSec > 0 ? (cpuDelta.user + cpuDelta.system) / 1e6 / cpuElapsedSec : 0;
    const cpuPct = Math.min(100, Math.round(cpuUtil * 100));
    if (cpuPct > stats.peakCpuPct) stats.peakCpuPct = cpuPct;
    if (cpuPct >= CPU_LIMIT_PCT) {
      stats.consecutiveHighCpu++;
      if (stats.consecutiveHighCpu >= STRESS_CPU_SUSTAINED_SAMPLES)
        stats.sustainedCpuExceeded = true;
    } else {
      stats.consecutiveHighCpu = 0;
    }

    const loadAvg = os.loadavg()[0];
    let dbStats: DbPoolStats | null = null;
    try {
      dbStats = await getConnectionPoolStats();
      if (dbStats) {
        const totalConn = dbStats.active + dbStats.idle;
        if (totalConn > stats.peakDbConnections) stats.peakDbConnections = totalConn;
        if (dbStats.pool_usage_pct >= POOL_EXHAUSTION_PCT) stats.dbPoolExhausted = true;
      }
    } catch {}

    const eventLoopUtil = getEventLoopUtilization();

    const logPayload: Record<string, unknown> = {
      ts: new Date().toISOString(),
      request_count: stats.requestCount,
      success_rate_pct: Math.round(successRate * 10) / 10,
      failure_rate_pct: Math.round(failRate * 10) / 10,
      booking_conflicts: stats.conflictCount,
      avg_latency_ms: Math.round(avgLatency),
      peak_latency_ms: peakLatency,
      heap_mb: Math.round(heapMb * 10) / 10,
      rps: Math.round(rps * 10) / 10,
      event_loop_lag_ms: Math.round(lagMs * 100) / 100,
      avg_event_loop_lag_ms: stats.eventLoopLagSamples.length
        ? Math.round(
            (stats.eventLoopLagSamples.reduce((a, b) => a + b, 0) /
              stats.eventLoopLagSamples.length) *
              100
          ) / 100
        : null,
      peak_event_loop_lag_ms: stats.eventLoopLagSamples.length
        ? Math.round(Math.max(...stats.eventLoopLagSamples) * 100) / 100
        : null,
      event_loop_utilization:
        eventLoopUtil != null ? Math.round(eventLoopUtil * 1000) / 1000 : null,
      process_cpu_pct: cpuPct,
      system_load_1m: Math.round(loadAvg * 100) / 100,
    };
    if (dbStats) {
      logPayload.db_active_connections = dbStats.active;
      logPayload.db_idle_connections = dbStats.idle;
      logPayload.db_waiting_queries = dbStats.waiting;
      logPayload.db_pool_usage_pct = Math.round(dbStats.pool_usage_pct * 10) / 10;
    }
    console.log(JSON.stringify({ stress_log: logPayload }));
    console.log(
      `[stress] requests=${stats.requestCount} success=${stats.successCount} fail=${stats.failureCount} conflicts=${stats.conflictCount} avg_ms=${Math.round(avgLatency)} peak_ms=${peakLatency} heap_mb=${logPayload.heap_mb} rps=${logPayload.rps} lag_ms=${logPayload.event_loop_lag_ms} cpu_pct=${cpuPct}${dbStats ? ` db_conn=${dbStats.active + dbStats.idle}` : ''}`
    );
  }, MONITOR_INTERVAL_MS);

  await Promise.all(workers);
  clearInterval(logInterval);
}

type VerificationResult = {
  doubleBookedSlots: string[];
  orphanBookings: string[];
  duplicateSlotBookings: number;
  invalidBookingStates: string[];
  invalidSlotStates: string[];
};

async function verifyAfterRun(): Promise<VerificationResult> {
  const result: VerificationResult = {
    doubleBookedSlots: [],
    orphanBookings: [],
    duplicateSlotBookings: 0,
    invalidBookingStates: [],
    invalidSlotStates: [],
  };

  const { data: confirmedBySlot } = await supabase
    .from('bookings')
    .select('slot_id')
    .eq('status', BOOKING_STATUS.CONFIRMED);

  const slotCounts: Record<string, number> = {};
  for (const row of confirmedBySlot || []) {
    const sid = row.slot_id as string;
    slotCounts[sid] = (slotCounts[sid] || 0) + 1;
  }
  for (const [slotId, count] of Object.entries(slotCounts)) {
    if (count > 1) {
      result.doubleBookedSlots.push(slotId);
      result.duplicateSlotBookings += count;
    }
  }

  const { data: allBookings } = await supabase.from('bookings').select('id, slot_id, business_id');
  const { data: allSlots } = await supabase.from('slots').select('id, business_id, status');

  const slotMap = new Map<string, { business_id: string; status: string }>();
  for (const s of allSlots || []) {
    slotMap.set(s.id, { business_id: s.business_id, status: s.status });
  }
  const validSlotStatuses = Object.values(SLOT_STATUS);
  const validBookingStatuses = Object.values(BOOKING_STATUS);

  for (const b of allBookings || []) {
    const slot = slotMap.get(b.slot_id as string);
    if (!slot) {
      result.orphanBookings.push(b.id as string);
    } else if ((b.business_id as string) !== slot.business_id) {
      result.orphanBookings.push(b.id as string);
    }
  }

  const { data: bookingsForState } = await supabase.from('bookings').select('id, status');
  for (const b of bookingsForState || []) {
    if (!validBookingStatuses.includes(b.status as string)) {
      result.invalidBookingStates.push(b.id as string);
    }
  }

  for (const s of allSlots || []) {
    if (!validSlotStatuses.includes(s.status as string)) {
      result.invalidSlotStates.push(s.id as string);
    }
  }

  return result;
}

function main(): void {
  const abortSignal: AbortFlag = { aborted: false };
  process.on('SIGINT', () => {
    abortSignal.aborted = true;
  });
  process.on('SIGTERM', () => {
    abortSignal.aborted = true;
  });

  const stats: StressStats = {
    requestCount: 0,
    successCount: 0,
    failureCount: 0,
    conflictCount: 0,
    latencies: [],
    memorySamples: [],
    eventLoopLagSamples: [],
    peakCpuPct: 0,
    peakDbConnections: 0,
    dbPoolExhausted: false,
    eventLoopLagExceeded: false,
    sustainedCpuExceeded: false,
    lastCpuUsage: process.cpuUsage(),
    lastCpuTime: Date.now(),
    consecutiveHighCpu: 0,
  };
  const startMemory = process.memoryUsage().heapUsed;

  loadSlotPool()
    .then((slotPool) => {
      console.log(
        JSON.stringify({
          stress_start: {
            base_url: BASE_URL,
            concurrent: CONCURRENT_USERS,
            duration_sec: DURATION_SEC,
            slot_pool_size: slotPool.length,
            monitor_interval_ms: MONITOR_INTERVAL_MS,
          },
        })
      );
      return runStress(slotPool, abortSignal, stats);
    })
    .then(() => verifyAfterRun())
    .then((verification) => {
      const endMemory = process.memoryUsage().heapUsed;
      const memoryGrowthMb = (endMemory - startMemory) / 1024 / 1024;
      const avgLatency = stats.latencies.length
        ? stats.latencies.reduce((a, b) => a + b, 0) / stats.latencies.length
        : 0;
      const peakLatency = stats.latencies.length ? Math.max(...stats.latencies) : 0;
      const successRate = stats.requestCount ? (stats.successCount / stats.requestCount) * 100 : 0;
      const errorRate = stats.requestCount ? (stats.failureCount / stats.requestCount) * 100 : 0;
      const avgEventLoopLag = stats.eventLoopLagSamples.length
        ? stats.eventLoopLagSamples.reduce((a, b) => a + b, 0) / stats.eventLoopLagSamples.length
        : 0;
      const peakEventLoopLag = stats.eventLoopLagSamples.length
        ? Math.max(...stats.eventLoopLagSamples)
        : 0;

      const report = {
        total_requests_executed: stats.requestCount,
        total_successful_bookings: stats.successCount,
        rejected_booking_attempts: stats.failureCount,
        booking_conflicts_409: stats.conflictCount,
        detected_race_conditions: verification.doubleBookedSlots.length,
        double_booked_slot_ids: verification.doubleBookedSlots,
        detected_data_inconsistencies:
          verification.orphanBookings.length +
          verification.invalidBookingStates.length +
          verification.invalidSlotStates.length,
        orphan_booking_ids: verification.orphanBookings,
        duplicate_confirmed_per_slot: verification.duplicateSlotBookings,
        invalid_booking_state_ids: verification.invalidBookingStates,
        invalid_slot_state_ids: verification.invalidSlotStates,
        average_latency_ms: Math.round(avgLatency),
        peak_latency_ms: peakLatency,
        success_rate_pct: Math.round(successRate * 10) / 10,
        error_rate_pct: Math.round(errorRate * 10) / 10,
        memory_growth_mb: Math.round(memoryGrowthMb * 100) / 100,
        average_event_loop_lag_ms: Math.round(avgEventLoopLag * 100) / 100,
        peak_event_loop_lag_ms: Math.round(peakEventLoopLag * 100) / 100,
        peak_cpu_pct: stats.peakCpuPct,
        peak_db_connections: stats.peakDbConnections,
        db_pool_exhausted: stats.dbPoolExhausted,
        event_loop_lag_exceeded: stats.eventLoopLagExceeded,
        sustained_cpu_exceeded: stats.sustainedCpuExceeded,
      };

      console.log(JSON.stringify({ stress_report: report }));
      console.log('\n--- STRESS TEST REPORT ---');
      console.log(`Total requests: ${report.total_requests_executed}`);
      console.log(`Successful bookings: ${report.total_successful_bookings}`);
      console.log(`Rejected attempts: ${report.rejected_booking_attempts}`);
      console.log(`Booking conflicts (409): ${report.booking_conflicts_409}`);
      console.log(
        `Detected race conditions (double-booked slots): ${report.detected_race_conditions}`
      );
      if (report.double_booked_slot_ids.length) {
        console.log(`Double-booked slot IDs: ${report.double_booked_slot_ids.join(', ')}`);
      }
      console.log(`Data inconsistencies: ${report.detected_data_inconsistencies}`);
      if (report.orphan_booking_ids.length)
        console.log(`Orphan bookings: ${report.orphan_booking_ids.length}`);
      if (report.invalid_booking_state_ids.length)
        console.log(`Invalid booking states: ${report.invalid_booking_state_ids.length}`);
      if (report.invalid_slot_state_ids.length)
        console.log(`Invalid slot states: ${report.invalid_slot_state_ids.length}`);
      console.log(`Avg latency: ${report.average_latency_ms} ms`);
      console.log(`Peak latency: ${report.peak_latency_ms} ms`);
      console.log(`Avg event loop lag: ${report.average_event_loop_lag_ms} ms`);
      console.log(`Peak event loop lag: ${report.peak_event_loop_lag_ms} ms`);
      console.log(`Peak CPU usage: ${report.peak_cpu_pct}%`);
      console.log(`Peak DB connections: ${report.peak_db_connections}`);
      console.log(`Success rate: ${report.success_rate_pct}%`);
      console.log(`Error rate: ${report.error_rate_pct}%`);
      console.log(`Memory growth: ${report.memory_growth_mb} MB`);
      if (report.db_pool_exhausted) console.log('FAIL: DB connection pool exhaustion detected');
      if (report.event_loop_lag_exceeded) console.log('FAIL: Event loop lag exceeded threshold');
      if (report.sustained_cpu_exceeded) console.log('FAIL: Sustained CPU usage above limit');
      console.log('--- END REPORT ---\n');

      const hasFailures =
        report.detected_race_conditions > 0 ||
        report.detected_data_inconsistencies > 0 ||
        report.db_pool_exhausted ||
        report.event_loop_lag_exceeded ||
        report.sustained_cpu_exceeded;
      process.exit(hasFailures ? 1 : 0);
    })
    .catch((err) => {
      console.error('Stress test failed:', err instanceof Error ? err.message : String(err));
      process.exit(1);
    });
}

main();
