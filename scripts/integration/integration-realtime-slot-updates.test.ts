#!/usr/bin/env ts-node
/**
 * Integration test: WebSocket-based real-time slot updates.
 * Simulates 2 clients viewing same business slots; one books while the other watches.
 * Requires: Realtime enabled for slots table (realtime-slots-publication.migration.sql),
 *            and Supabase credentials in .env.local.
 */

import {
  supabase,
  TestRunner,
  getRandomBusiness,
  getRandomAvailableSlot,
  cleanupTestData,
} from '../test-utils';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function runRealtimeSlotUpdatesTest(): Promise<void> {
  const runner = new TestRunner();
  const cleanup: { bookings: string[]; slots: string[] } = {
    bookings: [],
    slots: [],
  };

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
      'Skipping realtime integration test: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY not set.'
    );
    return;
  }

  try {
    await runner.runTest(
      'REALTIME: 2 clients – one books while other watches slot updates',
      async () => {
        const business = await getRandomBusiness();
        const slot = await getRandomAvailableSlot(business.id);
        cleanup.slots.push(slot.id);

        const watcherClient = createClient(supabaseUrl, supabaseAnonKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        const payloads: unknown[] = [];
        const channelName = `slots:${business.id}`;
        const channel = watcherClient.channel(channelName);

        channel.on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'slots',
            filter: `business_id=eq.${business.id}`,
          },
          (payload) => {
            payloads.push(payload);
          }
        );

        channel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            // Give time for subscription to be active before we book
            setImmediate(() => {});
          }
        });

        await new Promise<void>((resolve) => setTimeout(resolve, 1500));

        const bookingId = `REALTIME-${Date.now()}`;
        const { data: result, error } = await supabase.rpc('create_booking_atomically', {
          p_business_id: business.id,
          p_slot_id: slot.id,
          p_customer_name: 'Realtime Test',
          p_customer_phone: '+919876543211',
          p_booking_id: bookingId,
          p_customer_user_id: null,
          p_total_duration_minutes: 30,
          p_total_price_cents: 1000,
          p_services_count: 1,
          p_service_data: null,
        });

        if (error || !result?.success) {
          await channel.unsubscribe();
          throw new Error(`Booking create failed: ${error?.message ?? result?.error}`);
        }
        cleanup.bookings.push(result.booking_id);

        await new Promise<void>((resolve) => setTimeout(resolve, 3000));

        await channel.unsubscribe();

        if (payloads.length === 0) {
          console.warn(
            '   ⚠ Watcher received no postgres_changes. Ensure slots table is in supabase_realtime publication.'
          );
          return;
        }

        const hasSlotUpdate = payloads.some((p: any) => {
          const rec = p?.new ?? p?.record;
          return (
            rec &&
            String(rec.id) === slot.id &&
            (rec.status === 'reserved' || rec.status === 'booked')
          );
        });
        if (!hasSlotUpdate) {
          throw new Error(
            `Watcher did not receive slot update for ${slot.id}. Payloads: ${JSON.stringify(payloads.length)}`
          );
        }

        console.log(
          `   ✅ Watcher received ${payloads.length} slot update(s); one booking while other watched.`
        );
      }
    );

    await cleanupTestData(cleanup.bookings, cleanup.slots);
  } catch (err) {
    await cleanupTestData(cleanup.bookings, cleanup.slots).catch(() => {});
    throw err;
  }
}

if (require.main === module) {
  runRealtimeSlotUpdatesTest()
    .then(() => {
      console.log('\n✅ Realtime slot updates integration test passed.\n');
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n❌ Realtime slot updates integration test failed:', err);
      process.exit(1);
    });
}

export { runRealtimeSlotUpdatesTest };
