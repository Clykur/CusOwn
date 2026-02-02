#!/usr/bin/env ts-node
import { supabase, TestRunner, getRandomBusiness, getRandomAvailableSlot, getOrCreateTestUser, cleanupTestData, simulateUserAction } from './test-utils';
async function testPaymentFlow() {
  const runner = new TestRunner();
  const cleanup: { bookings: string[]; slots: string[]; payments: string[] } = { bookings: [], slots: [], payments: [] };
  let customer: any = null;
  try {
    await runner.runTest('STEP 1: User creates booking requiring payment', async () => {
      customer = await getOrCreateTestUser(`test-payment-${Date.now()}@test.com`, 'customer');
      const business = await getRandomBusiness();
      const slot = await getRandomAvailableSlot(business.id);
      await simulateUserAction('User creates booking');
      const bookingId = `PAY-${Date.now()}`;
      const { data, error } = await supabase.rpc('create_booking_atomically', {
        p_business_id: business.id, p_slot_id: slot.id, p_customer_name: 'Payment Test Customer',
        p_customer_phone: '+919876543210', p_booking_id: bookingId, p_customer_user_id: customer.id,
        p_total_duration_minutes: 30, p_total_price_cents: 1500, p_services_count: 1, p_service_data: null,
      });
      if (error || !data?.success) throw new Error(error?.message || data?.error || 'Booking creation failed');
      cleanup.bookings.push(data.booking_id);
      cleanup.slots.push(slot.id);
      (global as any).paymentBookingId = data.booking_id;
      await supabase.from('bookings').update({ payment_required: true, payment_type: 'full' }).eq('id', data.booking_id);
      console.log(`   Booking created: ${bookingId}`);
    });
    await runner.runTest('STEP 2: User initiates UPI payment', async () => {
      const bookingId = (global as any).paymentBookingId;
      await simulateUserAction('User initiates payment');
      const paymentId = `pay_${Date.now()}`;
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const { data: payment, error } = await supabase.from('payments').insert({
        booking_id: bookingId, provider: 'upi', provider_payment_id: paymentId, payment_id: paymentId,
        amount_cents: 1500, currency: 'INR', status: 'initiated', expires_at: expiresAt,
      }).select().single();
      if (error || !payment) throw new Error(`Failed to create payment: ${error?.message}`);
      cleanup.payments.push(payment.id);
      (global as any).paymentId = payment.id;
      
      console.log(`   ✅ Payment initiated`);
      console.log(`   💳 Payment ID: ${payment.payment_id}`);
      console.log(`   💰 Amount: ₹${(1500 / 100).toFixed(2)}`);
      console.log(`   📊 Status: ${payment.status}`);
      console.log(`   💳 Method: ${payment.provider.toUpperCase()}`);
      console.log(`   ⏰ Expires: ${new Date(expiresAt).toLocaleString()}`);
    });
    await runner.runTest('STEP 3: Payment succeeds', async () => {
      const paymentId = (global as any).paymentId;
      const bookingId = (global as any).paymentBookingId;
      await simulateUserAction('Payment succeeds');
      const { error } = await supabase.from('payments').update({
        status: 'completed', verified_at: new Date().toISOString(), verification_method: 'webhook',
      }).eq('id', paymentId).eq('status', 'initiated');
      if (error) throw new Error(`Failed to complete payment: ${error.message}`);
      
      const { data: updatedPayment } = await supabase
        .from('payments')
        .select('*')
        .eq('id', paymentId)
        .single();
      
      const { data: updatedBooking } = await supabase
        .from('bookings')
        .select('status')
        .eq('id', bookingId)
        .single();
      
      console.log(`   ✅ Payment verified successfully`);
      console.log(`   💳 Payment Status: ${updatedPayment?.status || 'N/A'}`);
      console.log(`   📋 Booking Status: ${updatedBooking?.status || 'N/A'}`);
      console.log(`   💰 Amount Paid: ₹${((updatedPayment?.amount_cents || 0) / 100).toFixed(2)}`);
      if (updatedPayment?.verified_at) {
        console.log(`   ⏰ Verified At: ${new Date(updatedPayment.verified_at).toLocaleString()}`);
      }
    });
  } finally {
    if (cleanup.payments.length > 0) await supabase.from('payments').delete().in('id', cleanup.payments);
    await cleanupTestData(cleanup.bookings, cleanup.slots);
  }
  runner.printSummary();
  return runner.getResults();
}
if (require.main === module) {
  testPaymentFlow().then(() => process.exit(0)).catch((error) => { console.error('Test failed:', error); process.exit(1); });
}
export { testPaymentFlow };
