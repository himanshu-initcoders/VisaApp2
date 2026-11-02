/**
 * Client-callable OTP server actions.
 * Core logic lives in otp-core.ts so Auth.js authorize can import it safely.
 */

'use server';

import {
  requestOtp as requestOtpCore,
  verifyOtpAndEnsureUser as verifyOtpAndEnsureUserCore,
} from '@/lib/auth/otp-core';

export async function requestOtp(input: {
  phone: string;
  ip?: string;
}): Promise<{ success: true } | { success: false; error: string }> {
  return requestOtpCore(input);
}

/** Exposed for tests / rare server callers; Auth.js should import otp-core. */
export async function verifyOtpAndEnsureUser(input: {
  phone: string;
  otp: string;
}): Promise<
  | { success: true; userId: string; phone: string }
  | { success: false; error: string }
> {
  return verifyOtpAndEnsureUserCore(input);
}
