/**
 * Client-callable email OTP server actions.
 * Core logic lives in email-otp-core.ts so Auth.js authorize can import it safely.
 */

'use server';

import {
  requestEmailLoginOtp as requestEmailLoginOtpCore,
  requestEmailRegisterOtp as requestEmailRegisterOtpCore,
  verifyEmailOtpAndEnsureUser as verifyEmailOtpAndEnsureUserCore,
} from '@/lib/auth/email-otp-core';
import { createEmailOtpProof } from '@/lib/auth/email-otp-proof';

export async function requestEmailLoginOtp(input: {
  email: string;
  ip?: string;
  resend?: boolean;
}): Promise<
  { success: true; sent: boolean } | { success: false; error: string }
> {
  return requestEmailLoginOtpCore(input);
}

export async function requestEmailRegisterOtp(input: {
  name: string;
  email: string;
  phone: string;
  ip?: string;
  resend?: boolean;
}): Promise<
  { success: true; sent: boolean } | { success: false; error: string }
> {
  return requestEmailRegisterOtpCore(input);
}

/**
 * Verify the email OTP on the server, create/claim the user if needed, and
 * return a short-lived proof for Auth.js to open the session.
 */
export async function completeEmailOtp(input: {
  email: string;
  otp: string;
  intent: 'login' | 'register';
}): Promise<
  | { success: true; email: string; proof: string }
  | { success: false; error: string }
> {
  const result = await verifyEmailOtpAndEnsureUserCore({
    email: input.email,
    otp: input.otp,
    intent: input.intent,
  });

  if (!result.success) {
    return result;
  }

  return {
    success: true,
    email: result.email,
    proof: createEmailOtpProof({
      userId: result.userId,
      email: result.email,
    }),
  };
}
