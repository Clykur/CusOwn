#!/usr/bin/env ts-node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TEST_PASSWORD = 'TestPassword123!'; // pragma: allowlist secret

async function createAuthenticatedClient(email: string, password: string) {
  if (!supabaseAnonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY required for RLS tests');
  }
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw new Error(`Sign-in failed for ${email}: ${error?.message ?? 'no session'}`);
  }
  return client;
}

function createAnonClient() {
  if (!supabaseAnonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY required for RLS tests');
  }
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function runSlotsRlsTests() {
  const ts = Date.now();
  const owner1Email = `rls-owner1-${ts}@test.local`;
  const owner2Email = `rls-owner2-${ts}@test.local`;
  const customerEmail = `rls-customer-${ts}@test.local`;
  const adminEmail = `rls-admin-${ts}@test.local`;

  let owner1Id: string;
  let owner2Id: string;
  let business1Id: string | undefined;
  let business2Id: string | undefined;
  let suspendedBusinessId: string | undefined;
  let deletedBusinessId: string | undefined;
  let slot1Available: string;
  let slot2Available: string;
  let slot2Booked: string;
  let slotSuspendedBiz: string;
  let slotDeletedBiz: string;

  try {
    const { data: u1 } = await serviceClient.auth.admin.createUser({
      email: owner1Email,
      password: TEST_PASSWORD,
      email_confirm: true,
    });
    const { data: u2 } = await serviceClient.auth.admin.createUser({
      email: owner2Email,
      password: TEST_PASSWORD,
      email_confirm: true,
    });
    const { data: uc } = await serviceClient.auth.admin.createUser({
      email: customerEmail,
      password: TEST_PASSWORD,
      email_confirm: true,
    });
    const { data: ua } = await serviceClient.auth.admin.createUser({
      email: adminEmail,
      password: TEST_PASSWORD,
      email_confirm: true,
    });
    if (!u1?.user?.id || !u2?.user?.id || !uc?.user?.id || !ua?.user?.id) {
      throw new Error('Failed to create test users');
    }
    owner1Id = u1.user.id;
    owner2Id = u2.user.id;

    await serviceClient.from('user_profiles').upsert(
      [
        { id: u1.user.id, user_type: 'owner', full_name: 'Owner 1' },
        { id: u2.user.id, user_type: 'owner', full_name: 'Owner 2' },
        { id: uc.user.id, user_type: 'customer', full_name: 'Customer' },
        { id: ua.user.id, user_type: 'admin', full_name: 'Admin' },
      ],
      { onConflict: 'id' }
    );

    const { data: b1 } = await serviceClient
      .from('businesses')
      .insert({
        salon_name: `RLS Biz1 ${ts}`,
        owner_name: 'Owner 1',
        whatsapp_number: `+9198765${String(ts).slice(-5)}`,
        opening_time: '09:00',
        closing_time: '18:00',
        slot_duration: 30,
        booking_link: `rls-b1-${ts}`,
        address: 'Addr 1',
        owner_user_id: owner1Id,
      })
      .select('id')
      .single();
    const { data: b2 } = await serviceClient
      .from('businesses')
      .insert({
        salon_name: `RLS Biz2 ${ts}`,
        owner_name: 'Owner 2',
        whatsapp_number: `+9198765${String(ts).slice(-4)}`,
        opening_time: '09:00',
        closing_time: '18:00',
        slot_duration: 30,
        booking_link: `rls-b2-${ts}`,
        address: 'Addr 2',
        owner_user_id: owner2Id,
      })
      .select('id')
      .single();
    if (!b1?.id || !b2?.id) throw new Error('Failed to create businesses');
    business1Id = b1.id;
    business2Id = b2.id;

    const { data: bSusp } = await serviceClient
      .from('businesses')
      .insert({
        salon_name: `RLS Suspended ${ts}`,
        owner_name: 'Owner 1',
        whatsapp_number: `+9198765${String(ts).slice(-3)}`,
        opening_time: '09:00',
        closing_time: '18:00',
        slot_duration: 30,
        booking_link: `rls-susp-${ts}`,
        address: 'Addr S',
        owner_user_id: owner1Id,
        suspended: true,
      })
      .select('id')
      .single();
    if (!bSusp?.id) throw new Error('Failed to create suspended business');
    suspendedBusinessId = bSusp.id;

    const { data: bDel } = await serviceClient
      .from('businesses')
      .insert({
        salon_name: `RLS Deleted ${ts}`,
        owner_name: 'Owner 1',
        whatsapp_number: `+9198765${String(ts).slice(-2)}`,
        opening_time: '09:00',
        closing_time: '18:00',
        slot_duration: 30,
        booking_link: `rls-del-${ts}`,
        address: 'Addr D',
        owner_user_id: owner1Id,
      })
      .select('id')
      .single();
    if (!bDel?.id) throw new Error('Failed to create business for delete');
    deletedBusinessId = bDel.id;
    await serviceClient
      .from('businesses')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', bDel.id);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];

    const { data: slots1 } = await serviceClient
      .from('slots')
      .insert([
        {
          business_id: business1Id,
          date: dateStr,
          start_time: '10:00',
          end_time: '10:30',
          status: 'available',
        },
        {
          business_id: business1Id,
          date: dateStr,
          start_time: '11:00',
          end_time: '11:30',
          status: 'reserved',
        },
      ])
      .select('id');
    const { data: slots2 } = await serviceClient
      .from('slots')
      .insert([
        {
          business_id: business2Id,
          date: dateStr,
          start_time: '10:00',
          end_time: '10:30',
          status: 'available',
        },
        {
          business_id: business2Id,
          date: dateStr,
          start_time: '11:00',
          end_time: '11:30',
          status: 'booked',
        },
      ])
      .select('id');
    const { data: slotSusp } = await serviceClient
      .from('slots')
      .insert([
        {
          business_id: suspendedBusinessId,
          date: dateStr,
          start_time: '10:00',
          end_time: '10:30',
          status: 'available',
        },
      ])
      .select('id')
      .single();
    const { data: slotDel } = await serviceClient
      .from('slots')
      .insert([
        {
          business_id: deletedBusinessId,
          date: dateStr,
          start_time: '10:00',
          end_time: '10:30',
          status: 'available',
        },
      ])
      .select('id')
      .single();

    if (!slots1?.length || !slots2?.length || !slotSusp?.id || !slotDel?.id)
      throw new Error('Failed to create slots');
    slot1Available = slots1[0].id;
    slot2Available = slots2[0].id;
    slot2Booked = slots2[1].id;
    slotSuspendedBiz = slotSusp.id;
    slotDeletedBiz = slotDel.id;

    const anonClient = createAnonClient();
    const anonSelect = await anonClient
      .from('slots')
      .select('id')
      .in('id', [slot1Available, slot2Available]);
    if (anonSelect.data && anonSelect.data.length > 0) {
      throw new Error('Anonymous user must not read any slots');
    }
    const { data: anonUpdateData } = await anonClient
      .from('slots')
      .update({ status: 'reserved' })
      .eq('id', slot1Available)
      .select('id');
    if (anonUpdateData && anonUpdateData.length > 0) {
      throw new Error('Anonymous user must not update any slot');
    }

    const customerClient = await createAuthenticatedClient(customerEmail, TEST_PASSWORD);
    const owner1Client = await createAuthenticatedClient(owner1Email, TEST_PASSWORD);
    const owner2Client = await createAuthenticatedClient(owner2Email, TEST_PASSWORD);
    const adminClient = await createAuthenticatedClient(adminEmail, TEST_PASSWORD);

    const customerSlots = await customerClient
      .from('slots')
      .select('id')
      .in('id', [slot1Available, slot2Available, slotSuspendedBiz, slotDeletedBiz]);
    if (customerSlots.error) {
      throw new Error(`Customer slots select failed: ${customerSlots.error.message}`);
    }
    const customerSlotList = customerSlots.data ?? [];
    if (customerSlotList.length !== 2) {
      throw new Error(
        `Customer should see only 2 slots (visible businesses), got ${customerSlotList.length}`
      );
    }
    const customerIds = customerSlotList.map((r: { id: string }) => r.id);
    if (customerIds.includes(slotSuspendedBiz) || customerIds.includes(slotDeletedBiz)) {
      throw new Error('Customer must not see slots of suspended or deleted business');
    }

    const { error: customerUpdate } = await customerClient
      .from('slots')
      .update({ status: 'reserved' })
      .eq('id', slot1Available);
    if (!customerUpdate) {
      const { data: after } = await serviceClient
        .from('slots')
        .select('status')
        .eq('id', slot1Available)
        .single();
      if (after?.status === 'reserved') {
        throw new Error('Customer must not be able to update any slot');
      }
    }

    const { data: owner1UpdateSuspended } = await owner1Client
      .from('slots')
      .update({ reserved_until: new Date(Date.now() + 600000).toISOString() })
      .eq('id', slotSuspendedBiz)
      .select('id');
    if (owner1UpdateSuspended && owner1UpdateSuspended.length > 0) {
      throw new Error('Owner must not modify slots of suspended business');
    }

    const { data: owner1UpdateDeleted } = await owner1Client
      .from('slots')
      .update({ reserved_until: new Date(Date.now() + 600000).toISOString() })
      .eq('id', slotDeletedBiz)
      .select('id');
    if (owner1UpdateDeleted && owner1UpdateDeleted.length > 0) {
      throw new Error('Owner must not modify slots of deleted business');
    }

    const { data: owner2UpdateBooked } = await owner2Client
      .from('slots')
      .update({ reserved_until: new Date(Date.now() + 600000).toISOString() })
      .eq('id', slot2Booked)
      .select('id');
    if (owner2UpdateBooked && owner2UpdateBooked.length > 0) {
      throw new Error('Owner must not modify booked slot');
    }

    const { error: owner1UpdateOwn } = await owner1Client
      .from('slots')
      .update({ reserved_until: new Date(Date.now() + 600000).toISOString() })
      .eq('id', slot1Available);
    if (owner1UpdateOwn) {
      throw new Error(`Owner must be able to update own business slot: ${owner1UpdateOwn.message}`);
    }

    const { data: owner2UpdateOther } = await owner2Client
      .from('slots')
      .update({ reserved_until: new Date(Date.now() + 600000).toISOString() })
      .eq('id', slot1Available)
      .select('id');
    if (owner2UpdateOther && owner2UpdateOther.length > 0) {
      throw new Error('Owner must not modify slots belonging to another business');
    }

    const adminAll = await adminClient
      .from('slots')
      .select('id')
      .in('id', [slot1Available, slot2Available, slot2Booked, slotSuspendedBiz, slotDeletedBiz]);
    if (adminAll.data?.length !== 5) {
      throw new Error(`Admin should see all 5 slots, got ${adminAll.data?.length}`);
    }

    const { error: adminUpdateBooked } = await adminClient
      .from('slots')
      .update({ reserved_until: new Date(Date.now() + 600000).toISOString() })
      .eq('id', slot2Booked);
    if (adminUpdateBooked) {
      throw new Error(`Admin must be able to update booked slot: ${adminUpdateBooked.message}`);
    }

    const { error: adminUpdate } = await adminClient
      .from('slots')
      .update({ reserved_until: new Date(Date.now() + 600000).toISOString() })
      .eq('id', slot2Available);
    if (adminUpdate) {
      throw new Error(`Admin must have unrestricted update: ${adminUpdate.message}`);
    }

    const { data: serviceInsert } = await serviceClient
      .from('slots')
      .insert({
        business_id: business1Id,
        date: dateStr,
        start_time: '14:00',
        end_time: '14:30',
        status: 'available',
      })
      .select('id')
      .single();
    if (!serviceInsert?.id) {
      throw new Error('Service role must be able to insert slots');
    }
    const { error: serviceDelete } = await serviceClient
      .from('slots')
      .delete()
      .eq('id', serviceInsert.id);
    if (serviceDelete) {
      throw new Error(`Service role must be able to delete slots: ${serviceDelete.message}`);
    }

    console.log('All slots RLS policy tests passed.');
  } finally {
    const ids = [business1Id, business2Id, suspendedBusinessId, deletedBusinessId].filter(
      Boolean
    ) as string[];
    if (ids.length > 0) {
      await serviceClient.from('slots').delete().in('business_id', ids);
      await serviceClient.from('businesses').delete().in('id', ids);
    }
  }
}

runSlotsRlsTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
