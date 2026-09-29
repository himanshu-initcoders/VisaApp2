/**
 * Mock mobile OTP helpers (AUTH_OTP_MODE=mock always accepts valid OTP).
 */

'use server';

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import {
  normalizeIndianPhone,
  otpSyntheticEmail,
} from '@/lib/auth/phone';
import {
  requestOtpSchema,
  verifyOtpSchema,
} from '@/lib/validations/auth';

const rateLimit = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60_000;

function otpMode(): 'mock' | 'sms' {
  const mode = (process.env.AUTH_OTP_MODE || 'mock').toLowerCase();
  return mode === 'sms' ? 'sms' : 'mock';
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

  if (otpMode() === 'sms') {
    return {
      success: false,
      error: 'SMS OTP is not configured yet. Set AUTH_OTP_MODE=mock.',
    };
  }

  // Mock: no SMS sent
  return { success: true };
}

/**
 * Verify OTP (mock always passes when Zod-valid) and find-or-create applicant user.
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

  if (otpMode() === 'sms') {
    return {
      success: false,
      error: 'SMS OTP is not configured yet. Set AUTH_OTP_MODE=mock.',
    };
  }

  // Mock: any Zod-valid 5-digit OTP is accepted
  void otp;

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
