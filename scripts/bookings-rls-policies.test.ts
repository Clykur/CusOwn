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

async function runBookingsRlsTests() {
  const ts = Date.now();
  const owner1Email = `rls-b-owner1-${ts}@test.local`;
  const owner2Email = `rls-b-owner2-${ts}@test.local`;
  const customer1Email = `rls-b-customer1-${ts}@test.local`;
  const customer2Email = `rls-b-customer2-${ts}@test.local`;
  const adminEmail = `rls-b-admin-${ts}@test.local`;

  let owner1Id: string;
  let owner2Id: string;
  let customer1Id: string;
  let customer2Id: string;
  let business1Id: string | undefined;
  let business2Id: string | undefined;
  let slot1Id: string | undefined;
  let slot2Id: string | undefined;
  let booking1Id: string | undefined;
  let booking2Id: string | undefined;

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
    const { data: uc1 } = await serviceClient.auth.admin.createUser({
      email: customer1Email,
      password: TEST_PASSWORD,
      email_confirm: true,
    });
    const { data: uc2 } = await serviceClient.auth.admin.createUser({
      email: customer2Email,
      password: TEST_PASSWORD,
      email_confirm: true,
    });
    const { data: ua } = await serviceClient.auth.admin.createUser({
      email: adminEmail,
      password: TEST_PASSWORD,
      email_confirm: true,
    });
    if (!u1?.user?.id || !u2?.user?.id || !uc1?.user?.id || !uc2?.user?.id || !ua?.user?.id) {
      throw new Error('Failed to create test users');
    }
    owner1Id = u1.user.id;
    owner2Id = u2.user.id;
    customer1Id = uc1.user.id;
    customer2Id = uc2.user.id;

    await serviceClient.from('user_profiles').upsert(
      [
        { id: u1.user.id, user_type: 'owner', full_name: 'Owner 1' },
        { id: u2.user.id, user_type: 'owner', full_name: 'Owner 2' },
        { id: uc1.user.id, user_type: 'customer', full_name: 'Customer 1' },
        { id: uc2.user.id, user_type: 'customer', full_name: 'Customer 2' },
        { id: ua.user.id, user_type: 'admin', full_name: 'Admin' },
      ],
      { onConflict: 'id' }
    );

    const { data: b1 } = await serviceClient
      .from('businesses')
      .insert({
        salon_name: `RLS B Biz1 ${ts}`,
        owner_name: 'Owner 1',
        whatsapp_number: `+9198765${String(ts).slice(-5)}`,
        opening_time: '09:00',
        closing_time: '18:00',
        slot_duration: 30,
        booking_link: `rls-b-b1-${ts}`,
        address: 'Addr 1',
        owner_user_id: owner1Id,
      })
      .select('id')
      .single();
    const { data: b2 } = await serviceClient
      .from('businesses')
      .insert({
        salon_name: `RLS B Biz2 ${ts}`,
        owner_name: 'Owner 2',
        whatsapp_number: `+9198765${String(ts).slice(-4)}`,
        opening_time: '09:00',
        closing_time: '18:00',
        slot_duration: 30,
        booking_link: `rls-b-b2-${ts}`,
        address: 'Addr 2',
        owner_user_id: owner2Id,
      })
      .select('id')
      .single();
    if (!b1?.id || !b2?.id) throw new Error('Failed to create businesses');
    business1Id = b1.id;
    business2Id = b2.id;

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];

    const { data: s1 } = await serviceClient
      .from('slots')
      .insert({
        business_id: business1Id,
        date: dateStr,
        start_time: '10:00',
        end_time: '10:30',
        status: 'available',
      })
      .select('id')
      .single();
    const { data: s2 } = await serviceClient
      .from('slots')
      .insert({
        business_id: business2Id,
        date: dateStr,
        start_time: '10:00',
        end_time: '10:30',
        status: 'available',
      })
      .select('id')
      .single();
    if (!s1?.id || !s2?.id) throw new Error('Failed to create slots');
    slot1Id = s1.id;
    slot2Id = s2.id;

    const { data: bk1 } = await serviceClient
      .from('bookings')
      .insert({
        business_id: business1Id,
        slot_id: slot1Id,
        customer_name: 'Customer 1',
        customer_phone: '+919876543210',
        booking_id: `rls-bk1-${ts}`,
        status: 'pending',
        customer_user_id: customer1Id,
      })
      .select('id')
      .single();
    const { data: bk2 } = await serviceClient
      .from('bookings')
      .insert({
        business_id: business2Id,
        slot_id: slot2Id,
        customer_name: 'Customer 2',
        customer_phone: '+919876543211',
        booking_id: `rls-bk2-${ts}`,
        status: 'pending',
        customer_user_id: customer2Id,
      })
      .select('id')
      .single();
    if (!bk1?.id || !bk2?.id) throw new Error('Failed to create bookings');
    booking1Id = bk1.id;
    booking2Id = bk2.id;

    const customer1Client = await createAuthenticatedClient(customer1Email, TEST_PASSWORD);
    const owner1Client = await createAuthenticatedClient(owner1Email, TEST_PASSWORD);
    const owner2Client = await createAuthenticatedClient(owner2Email, TEST_PASSWORD);
    const adminClient = await createAuthenticatedClient(adminEmail, TEST_PASSWORD);
    const anonClient = createAnonClient();

    const customer1Bookings = await customer1Client
      .from('bookings')
      .select('id')
      .in('id', [booking1Id, booking2Id]);
    if (customer1Bookings.error) {
      throw new Error(`Customer1 bookings select failed: ${customer1Bookings.error.message}`);
    }
    const customer1BookingList = customer1Bookings.data ?? [];
    if (customer1BookingList.length !== 1) {
      throw new Error(
        `Customer should see only their own bookings (1), got ${customer1BookingList.length}`
      );
    }
    if (!customer1BookingList.some((r: { id: string }) => r.id === booking1Id)) {
      throw new Error('Customer should see their own booking');
    }

    const owner1Bookings = await owner1Client
      .from('bookings')
      .select('id')
      .eq('business_id', business1Id);
    if (owner1Bookings.error) {
      throw new Error(`Owner1 bookings select failed: ${owner1Bookings.error.message}`);
    }
    const owner1List = owner1Bookings.data ?? [];
    if (owner1List.length < 1 || !owner1List.some((r: { id: string }) => r.id === booking1Id)) {
      throw new Error(
        `Owner1 should see bookings belonging to their business, got ${owner1List.length}`
      );
    }

    const owner2Other = await owner2Client
      .from('bookings')
      .select('id')
      .eq('id', booking1Id)
      .maybeSingle();
    if (owner2Other.error) {
      throw new Error(`Owner2 select other business booking failed: ${owner2Other.error.message}`);
    }
    if (owner2Other.data) {
      throw new Error('Owner2 must not view bookings belonging to another owner business');
    }

    const { data: customerUpdateOther } = await owner2Client
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', booking1Id)
      .select('id');
    if (customerUpdateOther && customerUpdateOther.length > 0) {
      throw new Error('Owner must not modify bookings belonging to another business');
    }

    const { data: customer1UpdateOwn } = await customer1Client
      .from('bookings')
      .update({ customer_name: 'Updated Name' })
      .eq('id', booking1Id)
      .select('id');
    if (customer1UpdateOwn && customer1UpdateOwn.length === 0) {
      throw new Error('Customer should be able to update their own booking');
    }

    const { data: customer1UpdateOther } = await customer1Client
      .from('bookings')
      .update({ customer_name: 'Hacked' })
      .eq('id', booking2Id)
      .select('id');
    if (customer1UpdateOther && customer1UpdateOther.length > 0) {
      throw new Error('Customer must not modify bookings they do not own');
    }

    const { data: owner1UpdateOwn } = await owner1Client
      .from('bookings')
      .update({ status: 'confirmed' })
      .eq('id', booking1Id)
      .select('id');
    if (owner1UpdateOwn && owner1UpdateOwn.length === 0) {
      throw new Error('Owner should be able to update bookings of their business');
    }

    const adminAll = await adminClient
      .from('bookings')
      .select('id')
      .in('id', [booking1Id, booking2Id]);
    if (adminAll.error) {
      throw new Error(`Admin bookings select failed: ${adminAll.error.message}`);
    }
    const adminList = adminAll.data ?? [];
    if (adminList.length !== 2) {
      throw new Error(`Admin should see all bookings (2), got ${adminList.length}`);
    }

    const { data: adminUpdateData } = await adminClient
      .from('bookings')
      .update({ status: 'rejected' })
      .eq('id', booking2Id)
      .select('id');
    if (!adminUpdateData || adminUpdateData.length === 0) {
      throw new Error('Admin should be able to update bookings from any business');
    }

    const anonSelect = await anonClient
      .from('bookings')
      .select('id')
      .in('id', [booking1Id, booking2Id]);
    if (anonSelect.error) {
      throw new Error(`Anon select failed: ${anonSelect.error.message}`);
    }
    const anonList = anonSelect.data ?? [];
    if (anonList.length > 0) {
      throw new Error(`Anonymous users must not read bookings, got ${anonList.length}`);
    }

    const { data: anonUpdateData } = await anonClient
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', booking1Id)
      .select('id');
    if (anonUpdateData && anonUpdateData.length > 0) {
      throw new Error('Anonymous users must not modify bookings');
    }

    console.log('All bookings RLS policy tests passed.');
  } finally {
    if (booking1Id && booking2Id) {
      await serviceClient.from('bookings').delete().in('id', [booking1Id, booking2Id]);
    }
    if (slot1Id && slot2Id) {
      await serviceClient.from('slots').delete().in('id', [slot1Id, slot2Id]);
    }
    if (business1Id && business2Id) {
      await serviceClient.from('businesses').delete().in('id', [business1Id, business2Id]);
    }
  }
}

runBookingsRlsTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
