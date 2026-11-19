/**
 * Short-lived tokens so Twilio can fetch private visa outcome files.
 *
 * Token format: base64url(payload)~base64url(hmac)
 * (tilde separator — not in base64url alphabet — so the path has a single
 * file-extension dot: `{token}.pdf`. Multiple dots break some media fetchers.)
 *
 * Twilio Content Template Media URL must be exactly: {{7}}
 * Variable {{7}} is the full HTTPS download URL.
 */

import { createHmac, timingSafeEqual } from 'crypto';
import { waMediaPathExtension } from '@/lib/visa/outcomeDocumentShared';

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
  // Tilde is not in base64url (A-Za-z0-9_-), so split is unambiguous.
  return `${body}~${sig}`;
}

export function verifyWaMediaToken(
  token: string
): { documentId: string } | null {
  // New format: body~sig. Legacy format: body.sig (pre-tilde).
  const tilde = token.indexOf('~');
  let body: string;
  let sig: string;
  if (tilde > 0) {
    body = token.slice(0, tilde);
    sig = token.slice(tilde + 1);
  } else {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    body = parts[0]!;
    sig = parts[1]!;
  }
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

/**
 * Public origin Twilio can HTTPS-fetch.
 * Prefer WA_MEDIA_PUBLIC_BASE_URL (e.g. https://www.viserv.in) over localhost.
 */
export function publicAppBaseUrl(): string {
  const raw =
    process.env.WA_MEDIA_PUBLIC_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    '';
  return raw.replace(/\/$/, '');
}

export function isPubliclyReachableMediaBase(base: string): boolean {
  try {
    const url = new URL(base);
    if (url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Builds the downloadable media URL for Twilio variable {{7}}.
 *
 * Twilio template Media URL field must be: {{7}}
 * (the full URL — not https://domain/api/wa-media/{{7}})
 *
 * Example {{7}}: https://www.viserv.in/api/wa-media/{token}.pdf
 */
export function buildWaMediaPublicUrl(
  documentId: string,
  mimeType?: string | null
): {
  fullUrl: string;
  pathVariable: string;
  /** Value for Twilio content variable {{7}} — full downloadable HTTPS URL. */
  mediaUrlVariable: string;
} | null {
  const base = publicAppBaseUrl();
  if (!base) return null;
  const token = signWaMediaToken(documentId);
  const ext = waMediaPathExtension(mimeType);
  const pathVariable = `${token}.${ext}`;
  const fullUrl = `${base}/api/wa-media/${pathVariable}`;

  if (!isPubliclyReachableMediaBase(base)) {
    console.warn(
      '[wa-media] Media base is not a public HTTPS URL. Twilio will fail with "No media available". Set WA_MEDIA_PUBLIC_BASE_URL=https://www.viserv.in (or an ngrok HTTPS URL).',
      { base, fullUrl }
    );
  }

  return {
    fullUrl,
    pathVariable,
    mediaUrlVariable: fullUrl,
  };
}
