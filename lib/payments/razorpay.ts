import 'server-only';

import crypto from 'crypto';
import Razorpay from 'razorpay';

let client: Razorpay | null = null;

export function razorpayKeyId(): string | null {
  const key =
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || '';
  if (!key.startsWith('rzp_')) return null;
  return key;
}

export function razorpayKeySecret(): string | null {
  const secret = process.env.RAZORPAY_KEY_SECRET || '';
  return secret.length > 0 ? secret : null;
}

export function getRazorpay(): Razorpay {
  const key_id = razorpayKeyId();
  const key_secret = razorpayKeySecret();
  if (!key_id || !key_secret) {
    throw new Error('Razorpay is not configured.');
  }
  if (!client) {
    client = new Razorpay({ key_id, key_secret });
  }
  return client;
}

export function signaturesMatch(expectedHex: string, receivedHex: string): boolean {
  const expected = Buffer.from(expectedHex.toLowerCase(), 'utf8');
  const received = Buffer.from(receivedHex.toLowerCase(), 'utf8');
  if (expected.length === 0 || expected.length !== received.length) return false;
  return crypto.timingSafeEqual(expected, received);
}

export function verifyCheckoutSignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const secret = razorpayKeySecret();
  if (!secret) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${input.orderId}|${input.paymentId}`)
    .digest('hex');
  return signaturesMatch(expected, input.signature);
}

export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
  if (!secret || !signature) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  return signaturesMatch(expected, signature);
}

export function normalizePaise(value: number | string | undefined): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
    return value;
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  return null;
}
