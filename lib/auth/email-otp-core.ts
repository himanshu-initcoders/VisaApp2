/**
 * Email OTP core (plain server module — safe to call from Auth.js authorize).
 * - mock: any valid 5-digit OTP works (local / CI); no email sent
 * - otherwise: store hashed challenge (10m expiry) and email the code
 */

import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { db, type Database } from '@/lib/db';
import { emailOtpChallenges, users } from '@/lib/db/schema';
import { normalizeIndianPhone } from '@/lib/auth/phone';
import {
  requestEmailLoginOtpSchema,
  requestEmailRegisterOtpSchema,
  verifyEmailOtpSchema,
} from '@/lib/validations/auth';
import {
  isDeliverableEmail,
  notifyEmailOtp,
} from '@/lib/email/notify';

const rateLimit = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60_000;
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
type OtpRequestResult =
  | { success: true; sent: boolean }
  | { success: false; error: string };

/** Collapse duplicate Send OTP clicks / React Strict Mode double-invokes. */
const inflightOtpRequests = new Map<string, Promise<OtpRequestResult>>();
/**
 * After a code is actually emailed, ignore an immediate duplicate request.
 * A deliberate Resend uses the shorter window so the button sends a new code.
 */
const OTP_RESEND_COOLDOWN_MS = 20_000;
const OTP_EXPLICIT_RESEND_COOLDOWN_MS = 2_000;

class OtpSendFailed extends Error {
  constructor() {
    super('OTP_EMAIL_FAILED');
    this.name = 'OtpSendFailed';
  }
}

function isOtpSendFailed(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current; depth += 1) {
    if (
      current instanceof OtpSendFailed ||
      (current instanceof Error && current.message === 'OTP_EMAIL_FAILED')
    ) {
      return true;
    }
    current = current instanceof Error ? current.cause : undefined;
  }
  return false;
}

function duplicateWindowMs(resend: boolean | undefined): number {
  return resend ? OTP_EXPLICIT_RESEND_COOLDOWN_MS : OTP_RESEND_COOLDOWN_MS;
}

/** True only for a clock-sane timestamp inside the window. A future timestamp must not suppress send. */
function issuedWithin(createdAt: Date, windowMs: number): boolean {
  const ageMs = Date.now() - createdAt.getTime();
  return ageMs >= 0 && ageMs < windowMs;
}

async function singleFlightOtpRequest(
  key: string,
  run: () => Promise<OtpRequestResult>
): Promise<OtpRequestResult> {
  const existing = inflightOtpRequests.get(key);
  if (existing) return existing;

  const pending = run().finally(() => {
    if (inflightOtpRequests.get(key) === pending) {
      inflightOtpRequests.delete(key);
    }
  });
  inflightOtpRequests.set(key, pending);
  return pending;
}

function otpMode(): 'mock' | 'email' {
  // Only explicit `mock` skips email. Unset / empty / anything else sends OTP.
  const mode = (process.env.AUTH_OTP_MODE ?? '').toLowerCase().trim();
  return mode === 'mock' ? 'mock' : 'email';
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

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function upsertChallenge(
  executor: Pick<Database, 'insert'>,
  input: {
    email: string;
    codeHash: string;
    purpose: 'login' | 'register';
    pendingName?: string | null;
    pendingPhone?: string | null;
  }
): Promise<void> {
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);
  const now = new Date();

  await executor
    .insert(emailOtpChallenges)
    .values({
      email: input.email,
      codeHash: input.codeHash,
      purpose: input.purpose,
      pendingName: input.pendingName ?? null,
      pendingPhone: input.pendingPhone ?? null,
      expiresAt,
      attempts: 0,
      createdAt: now,
    })
    .onConflictDoUpdate({
      target: emailOtpChallenges.email,
      set: {
        codeHash: input.codeHash,
        purpose: input.purpose,
        pendingName: input.pendingName ?? null,
        pendingPhone: input.pendingPhone ?? null,
        expiresAt,
        attempts: 0,
        createdAt: now,
      },
    });
}

export async function requestEmailLoginOtp(input: {
  email: string;
  ip?: string;
  resend?: boolean;
}): Promise<OtpRequestResult> {
  const parsed = requestEmailLoginOtpSchema.safeParse({
    email: normalizeEmail(input.email),
  });
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid email',
    };
  }

  const email = parsed.data.email;
  return singleFlightOtpRequest(`login:${email}`, () =>
    requestEmailLoginOtpInner({ ...input, email })
  );
}

async function requestEmailLoginOtpInner(input: {
  email: string;
  ip?: string;
  resend?: boolean;
}): Promise<OtpRequestResult> {
  const email = input.email;
  if (!isDeliverableEmail(email)) {
    return {
      success: false,
      error: 'Enter a valid email address',
    };
  }

  const limitKey = `login:${email}:${input.ip || 'unknown'}`;
  if (!checkRateLimit(limitKey)) {
    return {
      success: false,
      error: 'Too many OTP requests. Please wait a minute and try again.',
    };
  }

  const [existingUser] = await db
    .select({
      id: users.id,
      name: users.name,
      deactivatedAt: users.deactivatedAt,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!existingUser) {
    return {
      success: false,
      error: 'No account with this email. Create an account.',
    };
  }

  if (existingUser.deactivatedAt) {
    return {
      success: false,
      error: 'This account has been deactivated.',
    };
  }

  const mode = otpMode();

  if (mode === 'mock') {
    console.info(
      `[email-otp] mock login for ${email}: any 5-digit code works (e.g. 11111)`
    );
    return { success: true, sent: false };
  }

  return deliverEmailOtp({
    email,
    resend: input.resend,
    purpose: 'login',
    recipientName: existingUser.name,
  });
}

export async function requestEmailRegisterOtp(input: {
  name: string;
  email: string;
  phone: string;
  ip?: string;
  resend?: boolean;
}): Promise<OtpRequestResult> {
  const phoneNorm = normalizeIndianPhone(input.phone);
  const parsed = requestEmailRegisterOtpSchema.safeParse({
    name: input.name,
    email: normalizeEmail(input.email),
    phone: phoneNorm ?? input.phone,
  });
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid registration details',
    };
  }

  const { name, email, phone } = parsed.data;
  return singleFlightOtpRequest(`register:${email}`, () =>
    requestEmailRegisterOtpInner({
      name,
      email,
      phone,
      ip: input.ip,
      resend: input.resend,
    })
  );
}

async function requestEmailRegisterOtpInner(input: {
  name: string;
  email: string;
  phone: string;
  ip?: string;
  resend?: boolean;
}): Promise<OtpRequestResult> {
  const { name, email, phone } = input;
  if (!isDeliverableEmail(email)) {
    return {
      success: false,
      error: 'Enter a valid email address',
    };
  }

  const limitKey = `register:${email}:${input.ip || 'unknown'}`;
  if (!checkRateLimit(limitKey)) {
    return {
      success: false,
      error: 'Too many OTP requests. Please wait a minute and try again.',
    };
  }

  const [byEmail] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (byEmail) {
    return {
      success: false,
      error: 'An account with this email already exists. Sign in instead.',
    };
  }

  const [byPhone] = await db
    .select({
      id: users.id,
      email: users.email,
      deactivatedAt: users.deactivatedAt,
    })
    .from(users)
    .where(eq(users.phone, phone))
    .limit(1);

  if (byPhone) {
    if (byPhone.deactivatedAt) {
      return {
        success: false,
        error: 'This account has been deactivated.',
      };
    }
    if (isDeliverableEmail(byPhone.email)) {
      return {
        success: false,
        error:
          'This mobile number is already linked to an account. Sign in with that email.',
      };
    }
  }

  return deliverEmailOtp({
    email,
    resend: input.resend,
    purpose: 'register',
    recipientName: name,
    pendingName: name,
    pendingPhone: phone,
  });
}

/**
 * Store the code and email it in one database transaction.
 * The row commits only after the provider accepts the message, and a duplicate
 * request waits on the lock instead of treating an unsent row as success.
 */
async function deliverEmailOtp(input: {
  email: string;
  resend?: boolean;
  purpose: 'login' | 'register';
  recipientName: string;
  pendingName?: string | null;
  pendingPhone?: string | null;
}): Promise<OtpRequestResult> {
  const mode = otpMode();

  try {
    return await db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`email-otp:${input.email}`}), 0)`
      );

      const [recent] = await tx
        .select({
          purpose: emailOtpChallenges.purpose,
          attempts: emailOtpChallenges.attempts,
          createdAt: emailOtpChallenges.createdAt,
          pendingPhone: emailOtpChallenges.pendingPhone,
        })
        .from(emailOtpChallenges)
        .where(eq(emailOtpChallenges.email, input.email))
        .limit(1);

      const sameRequest =
        recent &&
        recent.purpose === input.purpose &&
        recent.attempts === 0 &&
        (input.purpose === 'login' ||
          recent.pendingPhone === (input.pendingPhone ?? null)) &&
        issuedWithin(recent.createdAt, duplicateWindowMs(input.resend));

      if (sameRequest) {
        console.info(
          `[email-otp] ${input.purpose} cooldown — keeping existing code for ${input.email}`
        );
        return { success: true, sent: false };
      }

      const code = generateOtpCode();
      await upsertChallenge(tx, {
        email: input.email,
        codeHash: hashOtp(code),
        purpose: input.purpose,
        pendingName: input.pendingName,
        pendingPhone: input.pendingPhone,
      });

      if (mode === 'mock') {
        console.info(
          `[email-otp] mock ${input.purpose} for ${input.email}: any 5-digit code works (e.g. 11111)`
        );
        return { success: true, sent: false };
      }

      const sent = await notifyEmailOtp({
        to: input.email,
        name: input.recipientName,
        code,
        purpose: input.purpose,
      });

      if (!sent) throw new OtpSendFailed();

      console.info(
        `[email-otp] ${input.purpose} OTP emailed to ${input.email}`
      );
      return { success: true, sent: true };
    });
  } catch (error) {
    if (isOtpSendFailed(error)) {
      return {
        success: false,
        error: 'Could not send OTP email. Please try again shortly.',
      };
    }
    throw error;
  }
}

/**
 * Verify email OTP and return the user id.
 * Login never creates an account. Register creates or claims a phone-only user.
 */
export async function verifyEmailOtpAndEnsureUser(input: {
  email: string;
  otp: string;
  intent: 'login' | 'register';
}): Promise<
  | { success: true; userId: string; email: string }
  | { success: false; error: string }
> {
  const parsed = verifyEmailOtpSchema.safeParse({
    email: normalizeEmail(input.email),
    // Strip spaces / formatting copied from email clients.
    otp: String(input.otp ?? '').replace(/\D/g, ''),
    intent: input.intent,
  });
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid OTP',
    };
  }

  const { email, otp, intent } = parsed.data;
  const mode = otpMode();

  let pendingName: string | null = null;
  let pendingPhone: string | null = null;

  if (mode === 'email' || intent === 'register') {
    const [challenge] = await db
      .select()
      .from(emailOtpChallenges)
      .where(eq(emailOtpChallenges.email, email))
      .limit(1);

    if (intent === 'register') {
      if (!challenge || challenge.purpose !== 'register') {
        return {
          success: false,
          error: 'No OTP found. Please request a new code.',
        };
      }
      pendingName = challenge.pendingName;
      pendingPhone = challenge.pendingPhone;
    }

    if (mode === 'email') {
      if (!challenge) {
        return {
          success: false,
          error: 'No OTP found. Please request a new code.',
        };
      }

      if (challenge.purpose !== intent) {
        return {
          success: false,
          error: 'No OTP found. Please request a new code.',
        };
      }

      if (challenge.expiresAt.getTime() < Date.now()) {
        await db
          .delete(emailOtpChallenges)
          .where(eq(emailOtpChallenges.email, email));
        return {
          success: false,
          error: 'OTP expired. Please request a new code.',
        };
      }

      if (challenge.attempts >= OTP_MAX_ATTEMPTS) {
        await db
          .delete(emailOtpChallenges)
          .where(eq(emailOtpChallenges.email, email));
        return {
          success: false,
          error: 'Too many incorrect attempts. Please request a new code.',
        };
      }

      if (!hashesMatch(challenge.codeHash, hashOtp(otp))) {
        await db
          .update(emailOtpChallenges)
          .set({ attempts: challenge.attempts + 1 })
          .where(eq(emailOtpChallenges.email, email));
        return { success: false, error: 'Invalid OTP. Please try again.' };
      }

      await db
        .delete(emailOtpChallenges)
        .where(eq(emailOtpChallenges.email, email));
    } else if (intent === 'register' && challenge) {
      // Mock register: consume challenge for pending fields; any 5 digits already validated by schema.
      await db
        .delete(emailOtpChallenges)
        .where(eq(emailOtpChallenges.email, email));
    }
  }

  if (intent === 'login') {
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!existing) {
      return {
        success: false,
        error: 'No account with this email. Create an account.',
      };
    }

    if (existing.deactivatedAt) {
      return {
        success: false,
        error: 'This account has been deactivated',
      };
    }

    if (!existing.emailVerified) {
      await db
        .update(users)
        .set({ emailVerified: new Date(), updatedAt: new Date() })
        .where(eq(users.id, existing.id));
    }

    return { success: true, userId: existing.id, email };
  }

  if (!pendingName?.trim() || !pendingPhone) {
    return {
      success: false,
      error: 'No OTP found. Please request a new code.',
    };
  }

  const phone = normalizeIndianPhone(pendingPhone);
  if (!phone) {
    return {
      success: false,
      error: 'Invalid mobile number on this request. Please try again.',
    };
  }

  const [emailTaken] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (emailTaken) {
    return {
      success: false,
      error: 'An account with this email already exists. Sign in instead.',
    };
  }

  const [byPhone] = await db
    .select()
    .from(users)
    .where(eq(users.phone, phone))
    .limit(1);

  const now = new Date();

  if (byPhone) {
    if (byPhone.deactivatedAt) {
      return {
        success: false,
        error: 'This account has been deactivated',
      };
    }

    if (isDeliverableEmail(byPhone.email)) {
      return {
        success: false,
        error:
          'This mobile number is already linked to an account. Sign in with that email.',
      };
    }

    await db
      .update(users)
      .set({
        name: pendingName.trim(),
        email,
        emailVerified: now,
        phoneVerified: now,
        updatedAt: now,
      })
      .where(eq(users.id, byPhone.id));

    return { success: true, userId: byPhone.id, email };
  }

  const [created] = await db
    .insert(users)
    .values({
      email,
      passwordHash: null,
      name: pendingName.trim(),
      phone,
      phoneVerified: now,
      emailVerified: now,
      role: 'user',
    })
    .returning({ id: users.id });

  return { success: true, userId: created.id, email };
}
