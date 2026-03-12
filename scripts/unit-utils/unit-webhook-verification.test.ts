#!/usr/bin/env ts-node

import { createHmac } from 'crypto';
import {
  verifyRazorpayWebhook,
  verifyStripeWebhook,
  getWebhookSecret,
} from '../../lib/security/webhook-verification';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function runTest(name: string, fn: () => void): void {
  fn();
  console.log(`  ✅ ${name}`);
}

export function runUnitWebhookVerificationTests(): void {
  console.log('\n--- unit: lib/security/webhook-verification ---\n');

  runTest('verifyRazorpayWebhook returns true for valid signature', () => {
    const secret = 'webhook-secret'; // pragma: allowlist secret
    const body = '{"event":"payment.captured"}';
    const hmac = createHmac('sha256', secret);
    hmac.update(body);
    const signature = hmac.digest('hex');
    assert(
      verifyRazorpayWebhook(body, signature, secret) === true,
      'Expected true for valid Razorpay signature'
    );
  });

  runTest('verifyRazorpayWebhook returns false for invalid signature', () => {
    const body = '{"event":"payment.captured"}';
    assert(
      verifyRazorpayWebhook(body, 'wrong-sig', 'secret') === false,
      'Expected false for wrong signature'
    );
    assert(
      verifyRazorpayWebhook(body, '', 'secret') === false,
      'Expected false for empty signature'
    );
  });

  runTest('verifyRazorpayWebhook returns false when body differs', () => {
    const secret = 'webhook-secret'; // pragma: allowlist secret
    const body1 = '{"a":1}';
    const body2 = '{"a":2}';
    const hmac = createHmac('sha256', secret);
    hmac.update(body1);
    const sig1 = hmac.digest('hex');
    assert(
      verifyRazorpayWebhook(body2, sig1, secret) === false,
      'Expected false when body differs'
    );
  });

  runTest('verifyStripeWebhook returns true for valid signed payload', () => {
    const secret = 'whsec'; // pragma: allowlist secret
    const body = '{"id":"evt_1"}';
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signedPayload = `${timestamp}.${body}`;
    const hmac = createHmac('sha256', secret);
    hmac.update(signedPayload);
    const signature = hmac.digest('hex');
    assert(
      verifyStripeWebhook(body, signature, secret, timestamp) === true,
      'Expected true for valid Stripe signature'
    );
  });

  runTest('verifyStripeWebhook returns false for invalid signature', () => {
    const body = '{}';
    const timestamp = '1234567890';
    assert(
      verifyStripeWebhook(body, 'invalid', 'secret', timestamp) === false,
      'Expected false for invalid Stripe signature'
    );
  });

  runTest('verifyStripeWebhook returns false when timestamp differs', () => {
    const secret = 'whsec'; // pragma: allowlist secret
    const body = '{}';
    const timestamp = '1234567890';
    const signedPayload = `${timestamp}.${body}`;
    const hmac = createHmac('sha256', secret);
    hmac.update(signedPayload);
    const signature = hmac.digest('hex');
    assert(
      verifyStripeWebhook(body, signature, secret, '9999999999') === false,
      'Expected false when timestamp differs'
    );
  });

  runTest('getWebhookSecret returns string for razorpay and stripe', () => {
    const razorpay = getWebhookSecret('razorpay');
    const stripe = getWebhookSecret('stripe');
    assert(typeof razorpay === 'string', 'razorpay secret must be string');
    assert(typeof stripe === 'string', 'stripe secret must be string');
  });
}

if (require.main === module) {
  runUnitWebhookVerificationTests();
  console.log('\n✅ unit-webhook-verification: all passed\n');
}
