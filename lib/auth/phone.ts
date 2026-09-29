/**
 * Indian mobile normalization — store 10-digit local numbers in DB.
 */

import { indianMobileSchema } from '@/lib/validations/auth';

/** Strip to 10-digit IN mobile (6–9 start). Returns null if invalid. */
export function normalizeIndianPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  const local =
    digits.length === 12 && digits.startsWith('91')
      ? digits.slice(2)
      : digits.length === 11 && digits.startsWith('0')
        ? digits.slice(1)
        : digits;
  const parsed = indianMobileSchema.safeParse(local);
  return parsed.success ? parsed.data : null;
}

export function formatPhoneDisplay(phone10: string): string {
  return `+91 ${phone10}`;
}

/** Synthetic unique email for OTP-only applicants (email column stays NOT NULL). */
export function otpSyntheticEmail(phone10: string): string {
  return `otp.${phone10}@users.local`;
}
