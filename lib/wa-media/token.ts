/**
 * Short-lived path tokens so Twilio can fetch private visa outcome PDFs.
 * Format: base64url(payloadJson).base64url(hmacSha256)
 */

import { createHmac, timingSafeEqual } from 'crypto';

const DEFAULT_TTL_SECONDS = 60 * 60; // 1 hour

function secret(): string {
  const value =
    process.env.NEXTAUTH_SECRET?.trim() ||
    process.env.CREDENTIALS_ENCRYPTION_KEY?.trim();
  if (!value) {
    throw new Error('NEXTAUTH_SECRET is required to sign WhatsApp media tokens');
  }
  return value;
}

function b64url(input: Buffer | string): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf8');
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromB64url(value: string): Buffer {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  return Buffer.from(padded + pad, 'base64');
}

export function signWaMediaToken(
  documentId: string,
  ttlSeconds = DEFAULT_TTL_SECONDS
): string {
  const payload = {
    d: documentId,
    e: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(
    createHmac('sha256', secret()).update(body).digest()
  );
  return `${body}.${sig}`;
}

export function verifyWaMediaToken(
  token: string
): { documentId: string } | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  if (!body || !sig) return null;

  const expected = createHmac('sha256', secret()).update(body).digest();
  let actual: Buffer;
  try {
    actual = fromB64url(sig);
  } catch {
    return null;
  }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return null;
  }

  try {
    const payload = JSON.parse(fromB64url(body).toString('utf8')) as {
      d?: unknown;
      e?: unknown;
    };
    if (typeof payload.d !== 'string' || typeof payload.e !== 'number') {
      return null;
    }
    if (payload.e < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return { documentId: payload.d };
  } catch {
    return null;
  }
}

export function publicAppBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    '';
  return raw.replace(/\/$/, '');
}

/** Full URL Twilio fetches: {base}/api/wa-media/{token} */
export function buildWaMediaPublicUrl(documentId: string): {
  fullUrl: string;
  pathVariable: string;
} | null {
  const base = publicAppBaseUrl();
  if (!base) return null;
  const token = signWaMediaToken(documentId);
  return {
    fullUrl: `${base}/api/wa-media/${token}`,
    pathVariable: token,
  };
}
