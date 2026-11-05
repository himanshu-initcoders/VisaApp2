/**
 * Short-lived HMAC proof issued after a successful email OTP verify.
 * Auth.js exchanges this for a session (avoids re-sending raw OTP through
 * form-urlencoded credentials).
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

const PROOF_TTL_MS = 2 * 60 * 1000;
const SEP = '|';

function proofSecret(): string {
  return (
    process.env.OTP_PEPPER?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    'viserv-otp-dev-pepper'
  );
}

function sign(payload: string): string {
  return createHmac('sha256', proofSecret()).update(payload).digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/** Opaque proof: userId|email|expiresAtMs|signature */
export function createEmailOtpProof(input: {
  userId: string;
  email: string;
}): string {
  const expiresAtMs = Date.now() + PROOF_TTL_MS;
  const email = input.email.trim().toLowerCase();
  const body = `${input.userId}${SEP}${email}${SEP}${expiresAtMs}`;
  return `${body}${SEP}${sign(body)}`;
}

export function verifyEmailOtpProof(input: {
  proof: string;
  email: string;
}): { success: true; userId: string } | { success: false; error: string } {
  const raw = String(input.proof ?? '').trim();
  const parts = raw.split(SEP);
  if (parts.length !== 4) {
    return { success: false, error: 'Invalid or expired sign-in proof.' };
  }

  const [userId, proofEmail, expiresRaw, signature] = parts;
  if (!userId || !proofEmail || !expiresRaw || !signature) {
    return { success: false, error: 'Invalid or expired sign-in proof.' };
  }

  const email = input.email.trim().toLowerCase();
  if (proofEmail !== email) {
    return { success: false, error: 'Invalid or expired sign-in proof.' };
  }

  const expiresAtMs = Number(expiresRaw);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs < Date.now()) {
    return { success: false, error: 'Sign-in proof expired. Please try again.' };
  }

  const body = `${userId}${SEP}${proofEmail}${SEP}${expiresAtMs}`;
  if (!safeEqual(signature, sign(body))) {
    return { success: false, error: 'Invalid or expired sign-in proof.' };
  }

  return { success: true, userId };
}
