/**
 * Mobile OTP helpers.
 * - mock: any valid 5-digit OTP signs in (local / CI)
 * - whatsapp: generate, store hashed challenge (10m expiry), send via Twilio template
 */

'use server';

import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { phoneOtpChallenges, users } from '@/lib/db/schema';
import {
  normalizeIndianPhone,
  otpSyntheticEmail,
} from '@/lib/auth/phone';
import {
  requestOtpSchema,
  verifyOtpSchema,
} from '@/lib/validations/auth';
import { sendLoginOtpWhatsApp } from '@/lib/whatsapp/notify';

const rateLimit = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60_000;
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

function otpMode(): 'mock' | 'whatsapp' {
  const mode = (process.env.AUTH_OTP_MODE || 'mock').toLowerCase();
  return mode === 'whatsapp' ? 'whatsapp' : 'mock';
}

function otpPepper(): string {
  return (
    process.env.OTP_PEPPER?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    'viserv-otp-dev-pepper'
  );
}

function hashOtp(code: string): string {
  return createHash('sha256').update(`${code}:${otpPepper()}`).digest('hex');
}

function hashesMatch(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

function generateOtpCode(): string {
  return String(randomInt(0, 100_000)).padStart(5, '0');
}

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimit.get(key);
  if (!entry || entry.resetAt < now) {
    rateLimit.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count += 1;
  return true;
}

export async function requestOtp(input: {
  phone: string;
  ip?: string;
}): Promise<{ success: true } | { success: false; error: string }> {
  const parsed = requestOtpSchema.safeParse({
    phone: normalizeIndianPhone(input.phone) ?? input.phone,
  });
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid phone number',
    };
  }

  const phone = parsed.data.phone;
  const limitKey = `${phone}:${input.ip || 'unknown'}`;
  if (!checkRateLimit(limitKey)) {
    return {
      success: false,
      error: 'Too many OTP requests. Please wait a minute and try again.',
    };
  }

  const mode = otpMode();
  const code = generateOtpCode();

  if (mode === 'mock') {
    console.info(`[otp] mock code for +91${phone}: ${code}`);
    return { success: true };
  }

  const [existingUser] = await db
    .select({ name: users.name, role: users.role })
    .from(users)
    .where(eq(users.phone, phone))
    .limit(1);

  if (
    existingUser &&
    (existingUser.role === 'admin' || existingUser.role === 'reviewer')
  ) {
    return {
      success: false,
      error: 'This number is linked to a staff account. Please use email login.',
    };
  }

  const displayName = existingUser?.name?.trim() || 'Traveller';
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);
  const codeHash = hashOtp(code);
  const now = new Date();

  await db
    .insert(phoneOtpChallenges)
    .values({
      phone,
      codeHash,
      expiresAt,
      attempts: 0,
      createdAt: now,
    })
    .onConflictDoUpdate({
      target: phoneOtpChallenges.phone,
      set: {
        codeHash,
        expiresAt,
        attempts: 0,
        createdAt: now,
      },
    });

  const sent = await sendLoginOtpWhatsApp({
    phone,
    name: displayName,
    code,
  });

  if (!sent) {
    await db
      .delete(phoneOtpChallenges)
      .where(eq(phoneOtpChallenges.phone, phone));
    return {
      success: false,
      error: 'Could not send OTP via WhatsApp. Please try again shortly.',
    };
  }

  return { success: true };
}

/**
 * Verify OTP and find-or-create applicant user.
 * Does not create a session — caller should signIn('phone-otp', …).
 */
export async function verifyOtpAndEnsureUser(input: {
  phone: string;
  otp: string;
}): Promise<
  | { success: true; userId: string; phone: string }
  | { success: false; error: string }
> {
  const phoneNorm = normalizeIndianPhone(input.phone);
  const parsed = verifyOtpSchema.safeParse({
    phone: phoneNorm ?? input.phone,
    otp: input.otp,
  });
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid OTP',
    };
  }

  const { phone, otp } = parsed.data;
  const mode = otpMode();

  if (mode === 'whatsapp') {
    const [challenge] = await db
      .select()
      .from(phoneOtpChallenges)
      .where(eq(phoneOtpChallenges.phone, phone))
      .limit(1);

    if (!challenge) {
      return {
        success: false,
        error: 'No OTP found. Please request a new code.',
      };
    }

    if (challenge.expiresAt.getTime() < Date.now()) {
      await db
        .delete(phoneOtpChallenges)
        .where(eq(phoneOtpChallenges.phone, phone));
      return {
        success: false,
        error: 'OTP expired. Please request a new code.',
      };
    }

    if (challenge.attempts >= OTP_MAX_ATTEMPTS) {
      await db
        .delete(phoneOtpChallenges)
        .where(eq(phoneOtpChallenges.phone, phone));
      return {
        success: false,
        error: 'Too many incorrect attempts. Please request a new code.',
      };
    }

    if (!hashesMatch(challenge.codeHash, hashOtp(otp))) {
      await db
        .update(phoneOtpChallenges)
        .set({ attempts: challenge.attempts + 1 })
        .where(eq(phoneOtpChallenges.phone, phone));
      return { success: false, error: 'Invalid OTP. Please try again.' };
    }

    await db
      .delete(phoneOtpChallenges)
      .where(eq(phoneOtpChallenges.phone, phone));
  }

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.phone, phone))
    .limit(1);

  if (existing) {
    if (existing.role === 'admin' || existing.role === 'reviewer') {
      return {
        success: false,
        error: 'This number is linked to a staff account. Please use email login.',
      };
    }

    if (existing.deactivatedAt) {
      return {
        success: false,
        error: 'This account has been deactivated',
      };
    }

    if (!existing.phoneVerified) {
      await db
        .update(users)
        .set({ phoneVerified: new Date(), updatedAt: new Date() })
        .where(eq(users.id, existing.id));
    }

    return { success: true, userId: existing.id, phone };
  }

  const [created] = await db
    .insert(users)
    .values({
      email: otpSyntheticEmail(phone),
      passwordHash: null,
      name: 'Traveller',
      phone,
      phoneVerified: new Date(),
      emailVerified: new Date(),
      role: 'user',
    })
    .returning({ id: users.id });

  return { success: true, userId: created.id, phone };
}
