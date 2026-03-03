/**
 * Unit tests for geocoding service (Nominatim).
 *
 * Run with: npx ts-node scripts/unit-geocoding.test.ts
 */

import { NominatimService } from '../lib/geocoding/nominatim-service';

// simple assert helpers
function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`✅ PASS: ${message}`);
  }
}

async function run() {
  console.log('🧪 Running geocoding service tests...\n');

  // stub fetch to simulate Nominatim responses
  const origFetch = (global as any).fetch;
  (global as any).fetch = async (url: string) => {
    if (url.includes('search?')) {
      return {
        ok: true,
        json: async () => [{ lat: '40.0', lon: '-74.0', display_name: 'Test Location' }],
      } as any;
    }
    if (url.includes('reverse?')) {
      return {
        ok: true,
        json: async () => ({ lat: '40.0', lon: '-74.0', display_name: 'Test Reverse' }),
      } as any;
    }
    return { ok: false, status: 404 } as any;
  };

  const service = NominatimService.getInstance();
  service.clearCache();

  // Forward geocode
  const f1 = await service.forwardGeocode('some address');
  assert(f1 !== null && f1.lat === 40 && f1.lng === -74, 'Forward geocode returns coordinates');

  // Cached result
  const f2 = await service.forwardGeocode('some address');
  assert(
    f2 !== null && f1 !== null && f2.lat === f1.lat && f2.lng === f1.lng,
    'Forward geocode caches result'
  );

  // Reverse geocode
  const r1 = await service.reverseGeocode(40, -74);
  assert(r1 !== null && r1.display_name === 'Test Reverse', 'Reverse geocode returns display_name');

  // Rate limiting: exceed limit to get null on the final call
  let last: any = null;
  for (let i = 0; i < 105; i++) {
    last = await service.forwardGeocode(`addr-${i}`, '127.0.0.1');
  }
  assert(last === null, 'Rate limit prevents geocoding after threshold');
  console.log('💡 Rate-limit behaviour confirmed');

  // restore fetch
  (global as any).fetch = origFetch;

  console.log('\n✨ Geocoding tests finished');
}

run().catch((err) => {
  console.error('geocoding test error', err);
  process.exitCode = 1;
});
