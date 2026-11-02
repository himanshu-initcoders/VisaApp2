import { randomInt } from 'crypto';
import { eq } from 'drizzle-orm';
import type { Database } from '@/lib/db';
import { visaApplications } from '@/lib/db/schema';

const REFERENCE_PREFIX = 'VI';
const DIGIT_COUNT = 12;
const MAX_ATTEMPTS = 12;

/** Matches public visa references like VI234567898765. */
export const VISA_REFERENCE_PATTERN = /^VI\d{12}$/;

export function isVisaReferenceNumber(value: string): boolean {
  return VISA_REFERENCE_PATTERN.test(value.trim().toUpperCase());
}

/** Normalize user/URL input to canonical VI + 12 digits, or null if invalid. */
export function normalizeVisaReferenceNumber(value: string): string | null {
  const normalized = value.trim().toUpperCase();
  return isVisaReferenceNumber(normalized) ? normalized : null;
}

/** Generate VI + 12 random digits (not uniqueness-checked). */
export function generateVisaReferenceNumber(): string {
  let digits = '';
  while (digits.length < DIGIT_COUNT) {
    digits += randomInt(0, 1_000_000_000).toString().padStart(9, '0');
  }
  return `${REFERENCE_PREFIX}${digits.slice(0, DIGIT_COUNT)}`;
}

/**
 * Allocate a reference that is not already used in visa_applications.
 * Callers should still handle rare unique-constraint races on insert.
 */
export async function ensureUniqueVisaReferenceNumber(
  database: Database
): Promise<string> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const candidate = generateVisaReferenceNumber();
    const [existing] = await database
      .select({ id: visaApplications.id })
      .from(visaApplications)
      .where(eq(visaApplications.referenceNumber, candidate))
      .limit(1);
    if (!existing) {
      return candidate;
    }
  }
  throw new Error('Unable to allocate a unique visa reference number');
}

/**
 * Resolve a URL/path segment to the internal UUID.
 * Accepts a public VI… reference or a legacy UUID.
 */
export async function resolveVisaApplicationId(
  database: Database,
  param: string
): Promise<string | null> {
  const trimmed = param.trim();
  if (!trimmed) return null;

  const reference = normalizeVisaReferenceNumber(trimmed);
  if (reference) {
    const [byRef] = await database
      .select({ id: visaApplications.id })
      .from(visaApplications)
      .where(eq(visaApplications.referenceNumber, reference))
      .limit(1);
    return byRef?.id ?? null;
  }

  const [byId] = await database
    .select({ id: visaApplications.id })
    .from(visaApplications)
    .where(eq(visaApplications.id, trimmed))
    .limit(1);
  return byId?.id ?? null;
}
