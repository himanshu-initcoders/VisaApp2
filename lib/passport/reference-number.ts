import { randomInt } from 'crypto';
import { eq, or } from 'drizzle-orm';
import type { Database } from '@/lib/db';
import { passportServices } from '@/lib/db/schema';

const REFERENCE_PREFIX = 'PS';
const DIGIT_COUNT = 12;
const MAX_ATTEMPTS = 12;

/** Canonical public passport references like PS313078877328. */
export const PASSPORT_REFERENCE_PATTERN = /^PS\d{12}$/;

/** Legacy prefix used briefly before PS; still accepted for lookup. */
const LEGACY_REFERENCE_PATTERN = /^PP\d{12}$/;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isPassportReferenceNumber(value: string): boolean {
  return PASSPORT_REFERENCE_PATTERN.test(value.trim().toUpperCase());
}

/** Normalize user/URL input to canonical PS + 12 digits, or null if invalid. */
export function normalizePassportReferenceNumber(value: string): string | null {
  const normalized = value.trim().toUpperCase();
  if (PASSPORT_REFERENCE_PATTERN.test(normalized)) return normalized;
  // Map legacy PP… URLs to the canonical PS… form.
  if (LEGACY_REFERENCE_PATTERN.test(normalized)) {
    return `PS${normalized.slice(2)}`;
  }
  return null;
}

/** Generate PS + 12 random digits (not uniqueness-checked). */
export function generatePassportReferenceNumber(): string {
  let digits = '';
  while (digits.length < DIGIT_COUNT) {
    digits += randomInt(0, 1_000_000_000).toString().padStart(9, '0');
  }
  return `${REFERENCE_PREFIX}${digits.slice(0, DIGIT_COUNT)}`;
}

/**
 * Allocate a reference that is not already used in passport_services.
 * Callers should still handle rare unique-constraint races on insert.
 */
export async function ensureUniquePassportReferenceNumber(
  database: Database
): Promise<string> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const candidate = generatePassportReferenceNumber();
    const [existing] = await database
      .select({ id: passportServices.id })
      .from(passportServices)
      .where(eq(passportServices.referenceNumber, candidate))
      .limit(1);
    if (!existing) return candidate;
  }
  throw new Error('Could not allocate a unique passport reference number');
}

/**
 * Resolve a URL/path segment to the internal UUID.
 * Accepts PS… (canonical), legacy PP…, or a UUID.
 */
export async function resolvePassportApplicationId(
  database: Database,
  param: string
): Promise<string | null> {
  const trimmed = param.trim();
  if (!trimmed) return null;

  const upper = trimmed.toUpperCase();
  const canonical = normalizePassportReferenceNumber(upper);

  if (canonical) {
    const legacy = `PP${canonical.slice(2)}`;
    const [byRef] = await database
      .select({ id: passportServices.id })
      .from(passportServices)
      .where(
        or(
          eq(passportServices.referenceNumber, canonical),
          eq(passportServices.referenceNumber, legacy)
        )
      )
      .limit(1);
    return byRef?.id ?? null;
  }

  if (!UUID_PATTERN.test(trimmed)) {
    return null;
  }

  const [byId] = await database
    .select({ id: passportServices.id })
    .from(passportServices)
    .where(eq(passportServices.id, trimmed))
    .limit(1);
  return byId?.id ?? null;
}
