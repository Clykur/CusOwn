#!/usr/bin/env ts-node

import { createSafeMetrics } from '../lib/monitoring/safe-metrics-core';
import type { MetricsLike } from '../lib/monitoring/safe-metrics-core';
import { METRICS_SERVICE_NAME } from '../config/constants';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function runTest(name: string, fn: () => void | Promise<void>): Promise<void> {
  await fn();
  console.log(`  ✅ ${name}`);
}

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

export async function runMetricsReliabilityHardeningTests(): Promise<void> {
  console.log('\n--- metrics reliability hardening ---\n');

  await runTest('safeIncrement never throws when underlying increment throws', async () => {
    const impl: MetricsLike = {
      increment: async () => {
        throw new Error('increment failed');
      },
      recordTiming: async () => {},
      setGauge: async () => {},
      getCount: async () => 0,
      getTimings: async () => [],
    };
    const safe = createSafeMetrics(impl);
    safe.increment('test.metric', 1);
    await flushMicrotasks();
  });

  await runTest(
    'safeGetCount returns 0 and does not throw when underlying getCount throws',
    async () => {
      const impl: MetricsLike = {
        increment: async () => {},
        recordTiming: async () => {},
        setGauge: async () => {},
        getCount: async () => {
          throw new Error('getCount failed');
        },
        getTimings: async () => [],
      };
      const safe = createSafeMetrics(impl);
      const result = await safe.getCount('test.metric');
      assert(result === 0, `Expected 0, got ${result}`);
    }
  );

  await runTest(
    'metrics failure logs structured warning with service, metric_name, error_type, request_id',
    async () => {
      const warnCalls: string[] = [];
      const originalWarn = console.warn;
      console.warn = (arg: unknown) => {
        warnCalls.push(typeof arg === 'string' ? arg : String(arg));
      };
      const impl: MetricsLike = {
        increment: async () => {
          throw new Error('db unavailable');
        },
        recordTiming: async () => {},
        setGauge: async () => {},
        getCount: async () => 0,
        getTimings: async () => [],
      };
      try {
        const safe = createSafeMetrics(impl);
        safe.increment('api.booking.created', 1, 'req-abc-123');
        await flushMicrotasks();
        assert(warnCalls.length >= 1, 'Expected at least one warn log');
        const lastLog = warnCalls[warnCalls.length - 1];
        const parsed = JSON.parse(lastLog) as Record<string, unknown>;
        assert(parsed.message === 'Metrics operation failed', 'Expected failure message');
        assert(parsed.service === METRICS_SERVICE_NAME, 'Expected service name');
        assert(parsed.metric_name === 'api.booking.created', 'Expected metric_name');
        assert(parsed.request_id === 'req-abc-123', 'Expected request_id');
        assert(typeof parsed.error_type === 'string', 'Expected error_type');
        assert(typeof parsed.ts === 'string', 'Expected timestamp');
      } finally {
        console.warn = originalWarn;
      }
    }
  );

  await runTest('safeRecordTiming never throws when underlying recordTiming throws', async () => {
    const impl: MetricsLike = {
      increment: async () => {},
      recordTiming: async () => {
        throw new Error('recordTiming failed');
      },
      setGauge: async () => {},
      getCount: async () => 0,
      getTimings: async () => [],
    };
    const safe = createSafeMetrics(impl);
    safe.recordTiming('api.latency', 100);
    await flushMicrotasks();
  });

  await runTest('safeSetGauge never throws when underlying setGauge throws', async () => {
    const impl: MetricsLike = {
      increment: async () => {},
      recordTiming: async () => {},
      setGauge: async () => {
        throw new Error('setGauge failed');
      },
      getCount: async () => 0,
      getTimings: async () => [],
    };
    const safe = createSafeMetrics(impl);
    safe.setGauge('cron.last_run', 12345);
    await flushMicrotasks();
  });
}

if (require.main === module) {
  runMetricsReliabilityHardeningTests()
    .then(() => {
      console.log('\n✅ Metrics reliability hardening tests passed\n');
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
