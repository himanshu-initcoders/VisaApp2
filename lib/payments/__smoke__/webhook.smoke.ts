/**
 * Smoke: webhook signature + ack paths (no live Razorpay / DB capture required).
 * Run: npx tsx lib/payments/__smoke__/webhook.smoke.ts
 */

import crypto from 'crypto';
import { createRequire } from 'node:module';
import type { Module } from 'node:module';

const require = createRequire(import.meta.url);
const serverOnlyPath = require.resolve('server-only');
require.cache[serverOnlyPath] = {
  id: serverOnlyPath,
  filename: serverOnlyPath,
  loaded: true,
  exports: {},
  children: [],
  paths: [],
  parent: null,
  path: '',
  isPreloading: false,
  require,
} as Module;

process.env.RAZORPAY_WEBHOOK_SECRET = 'smoke_webhook_secret';

function sign(rawBody: string): string {
  return crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!)
    .update(rawBody)
    .digest('hex');
}

async function post(rawBody: string, signature?: string) {
  const { POST } = await import('@/app/api/razorpay/webhook/route');
  const headers = new Headers();
  if (signature !== undefined) {
    headers.set('x-razorpay-signature', signature);
  }
  return POST(
    new Request('http://localhost/api/razorpay/webhook', {
      method: 'POST',
      headers,
      body: rawBody,
    })
  );
}

async function expectStatus(
  label: string,
  response: Response,
  status: number
) {
  if (response.status !== status) {
    const text = await response.text();
    throw new Error(
      `${label}: expected ${status}, got ${response.status} (${text})`
    );
  }
  console.log(`ok  ${label} → ${status}`);
}

async function main() {
  const { verifyWebhookSignature } = await import('@/lib/payments/razorpay');

  const sample = JSON.stringify({ event: 'payment.authorized' });
  if (!verifyWebhookSignature(sample, sign(sample))) {
    throw new Error('verifyWebhookSignature should accept a valid HMAC');
  }
  if (verifyWebhookSignature(sample, 'deadbeef')) {
    throw new Error('verifyWebhookSignature should reject a bad HMAC');
  }
  console.log('ok  signature helpers');

  await expectStatus(
    'bad signature',
    await post(sample, 'not-a-valid-signature'),
    400
  );

  await expectStatus(
    'invalid JSON',
    await post('{not-json', sign('{not-json')),
    400
  );

  await expectStatus('unknown event', await post(sample, sign(sample)), 200);

  const capturedMissing = JSON.stringify({
    event: 'payment.captured',
    payload: { payment: { entity: {} } },
  });
  await expectStatus(
    'payment.captured missing ids',
    await post(capturedMissing, sign(capturedMissing)),
    200
  );

  const failedMissingOrder = JSON.stringify({
    event: 'payment.failed',
    payload: { payment: { entity: { id: 'pay_smoke' } } },
  });
  await expectStatus(
    'payment.failed missing order',
    await post(failedMissingOrder, sign(failedMissingOrder)),
    200
  );

  const orderPaidMissing = JSON.stringify({
    event: 'order.paid',
    payload: { order: { entity: {} } },
  });
  await expectStatus(
    'order.paid missing id',
    await post(orderPaidMissing, sign(orderPaidMissing)),
    200
  );

  // Missing/invalid gateway credentials → fetch fails → retriable 500.
  delete process.env.RAZORPAY_KEY_ID;
  delete process.env.RAZORPAY_KEY_SECRET;
  delete process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const capturedRetriable = JSON.stringify({
    event: 'payment.captured',
    payload: {
      payment: {
        entity: { id: 'pay_smoke_retry', order_id: 'order_smoke_retry' },
      },
    },
  });
  await expectStatus(
    'payment.captured gateway failure retries',
    await post(capturedRetriable, sign(capturedRetriable)),
    500
  );

  console.log('\nWebhook smoke passed (signature + ack + retry paths).');
  console.log(
    'Live race matrix (browser/webhook/resume) still needs Razorpay test mode + public URL.'
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
