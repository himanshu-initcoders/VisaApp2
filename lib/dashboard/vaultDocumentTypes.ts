/**
 * Which document slots belong in the applicant personal vault.
 *
 * Real-world model:
 * - Vault = reusable personal docs (passport, photo, bank statements, …)
 * - Outcome PDFs (visa_outcome / passport_outcome) are per-application staff
 *   deliveries — never editable in the user vault, and not listed there.
 */

import { DOCUMENT_TYPE_VALUES } from '@/lib/document-types';
import { isOutcomeDocumentSlot } from '@/lib/visa/outcomeDocumentShared';

const UUID_SLOT_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Stable apply slots that are always applicant-owned. */
export const STABLE_APPLICANT_SLOTS = new Set([
  'passport-front',
  'passport-back',
  'passport_back',
  'photo',
]);

const CATALOG_TYPES = new Set<string>(DOCUMENT_TYPE_VALUES);

export function isUuidSlotKey(slotKey: string): boolean {
  return UUID_SLOT_RE.test(slotKey.trim());
}

/**
 * True when this slot/type may appear in the user document vault
 * and the applicant may replace it.
 */
export function isApplicantVaultSlot(slotKey: string): boolean {
  const key = slotKey.trim();
  if (!key) return false;
  if (isOutcomeDocumentSlot(key)) return false;
  if (STABLE_APPLICANT_SLOTS.has(key)) return true;
  if (CATALOG_TYPES.has(key)) return true;
  // Listing component keys (UUID) are applicant upload slots.
  if (isUuidSlotKey(key)) return true;
  return false;
}

/**
 * Normalize a storage slot into a stable vault identity for dedupe/labels.
 * Prefer catalog documentType when known (so the same bank-statement type
 * across two listings collapses to one vault card).
 */
export function vaultDocumentIdentity(
  slotKey: string,
  catalogDocumentType?: string | null
): string {
  const catalog = (catalogDocumentType || '').trim();
  if (catalog && (CATALOG_TYPES.has(catalog) || catalog === 'photo')) {
    if (catalog === 'passport') return 'passport-front';
    if (catalog === 'passport_back') return 'passport-back';
    return catalog;
  }

  const key = slotKey.trim();
  if (key === 'passport_back') return 'passport-back';
  if (STABLE_APPLICANT_SLOTS.has(key)) return key;
  if (CATALOG_TYPES.has(key)) return key;
  return key;
}
