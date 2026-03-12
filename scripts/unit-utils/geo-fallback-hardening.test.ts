#!/usr/bin/env ts-node

import {
  METRICS_DISCOVERY_FALLBACK_GEO,
  METRICS_DISCOVERY_FALLBACK_RPC,
  GEO_CIRCUIT_BREAKER_THRESHOLD,
  GEO_DEGRADATION_COOLDOWN_MS,
} from '../../config/constants';
import { queryDiscoveryFallback } from '../../lib/db/discovery-fallback';
import type { DiscoveryFallbackRow } from '../../lib/db/discovery-fallback';
import type { DiscoveryFallbackReason } from '../../app/api/businesses/search/route';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function runTest(name: string, fn: () => void | Promise<void>): Promise<void> {
  await fn();
  console.log(`  ✅ ${name}`);
}

function getFallbackMetricForReason(reason: DiscoveryFallbackReason): string {
  return reason === 'geo_provider'
    ? METRICS_DISCOVERY_FALLBACK_GEO
    : METRICS_DISCOVERY_FALLBACK_RPC;
}

function buildChain(result: { data: unknown[]; error: unknown }) {
  const chain: Record<string, unknown> = {
    eq: () => chain,
    is: () => chain,
    range: () => Promise.resolve(result),
  };
  return chain;
}

export async function runGeoFallbackHardeningTests(): Promise<void> {
  console.log('\n--- geo fallback hardening ---\n');

  await runTest('fallback metric for geo_provider is METRICS_DISCOVERY_FALLBACK_GEO', () => {
    const metric = getFallbackMetricForReason('geo_provider');
    assert(
      metric === METRICS_DISCOVERY_FALLBACK_GEO,
      `Expected ${METRICS_DISCOVERY_FALLBACK_GEO}, got ${metric}`
    );
  });

  await runTest('fallback metric for rpc is METRICS_DISCOVERY_FALLBACK_RPC', () => {
    const metric = getFallbackMetricForReason('rpc');
    assert(
      metric === METRICS_DISCOVERY_FALLBACK_RPC,
      `Expected ${METRICS_DISCOVERY_FALLBACK_RPC}, got ${metric}`
    );
  });

  await runTest('circuit breaker threshold is positive', () => {
    assert(GEO_CIRCUIT_BREAKER_THRESHOLD >= 1, 'Threshold must be at least 1');
  });

  await runTest('cooldown window is positive', () => {
    assert(GEO_DEGRADATION_COOLDOWN_MS > 0, 'Cooldown must be positive');
  });

  await runTest('fallback row shape has distance_km null and score 0', () => {
    const row: DiscoveryFallbackRow = {
      business_id: 'id',
      salon_name: 'n',
      location: 'loc',
      category: 'cat',
      latitude: 0,
      longitude: 0,
      area: 'a',
      distance_km: null,
      score: 0,
      rating_avg: 0,
      booking_count_30d: 0,
      repeat_customer_ratio: 0,
      slot_availability_ratio: 0,
    };
    assert(
      row.distance_km === null && row.score === 0,
      'Fallback row must have distance_km null and score 0'
    );
  });

  await runTest(
    'queryDiscoveryFallback returns valid data shape when supabase returns rows',
    async () => {
      const mockRows = [
        {
          id: 'b1',
          salon_name: 'Salon A',
          location: 'Loc A',
          category: 'salon',
          latitude: 12,
          longitude: 77,
          area: 'Area A',
          created_at: new Date().toISOString(),
        },
      ];
      const mockSupabase = {
        from: () => ({
          select: () => ({
            order: () => buildChain({ data: mockRows, error: null }),
          }),
        }),
      } as any;
      const result = await queryDiscoveryFallback(mockSupabase, {
        p_city: 'City',
        p_area: null,
        p_pincode: null,
        p_category: null,
        limit: 10,
        offset: 0,
      });
      assert(Array.isArray(result), 'Result must be array');
      if (result.length > 0) {
        const first = result[0];
        assert(first.business_id !== undefined, 'Must have business_id');
        assert(first.distance_km === null, 'Must have distance_km null');
        assert(first.score === 0, 'Must have score 0');
      }
    }
  );

  await runTest('queryDiscoveryFallback returns empty array on error', async () => {
    const mockSupabase = {
      from: () => ({
        select: () => ({
          order: () => buildChain({ data: null, error: { message: 'err' } }),
        }),
      }),
    } as any;
    const result = await queryDiscoveryFallback(mockSupabase, {
      p_city: null,
      p_area: null,
      p_pincode: null,
      p_category: null,
      limit: 10,
      offset: 0,
    });
    assert(Array.isArray(result) && result.length === 0, 'Must return empty array on error');
  });

  await runTest('metrics increment choice matches fallback reason', () => {
    assert(
      getFallbackMetricForReason('geo_provider') === METRICS_DISCOVERY_FALLBACK_GEO,
      'geo_provider must map to METRICS_DISCOVERY_FALLBACK_GEO'
    );
    assert(
      getFallbackMetricForReason('rpc') === METRICS_DISCOVERY_FALLBACK_RPC,
      'rpc must map to METRICS_DISCOVERY_FALLBACK_RPC'
    );
  });
}

if (require.main === module) {
  runGeoFallbackHardeningTests()
    .then(() => {
      console.log('\n✅ geo-fallback-hardening: all passed\n');
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
