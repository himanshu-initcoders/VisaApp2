/**
 * Passport apply draft files — same draft → promote path as visa.
 * Draft keys live under applications/IN/{listingId}/{userId}/drafts/...
 * Submit promotes them into the application id path; never treat drafts as final.
 */

export const PASSPORT_DRAFT_COUNTRY_CODE = 'IN';
export const PASSPORT_DRAFT_PASSENGER_ID = 'primary';

export type PassportDraftUpload = {
  /** Draft object key from /api/apply/draft-files (result.key). */
  storageKey: string;
  filename: string;
  mimeType?: string;
  size?: number;
};

/** Normalize wizard/draft payload (supports legacy `s3Key` field name). */
export function normalizePassportDraftUpload(
  value: unknown
): PassportDraftUpload | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const storageKey =
    (typeof row.storageKey === 'string' && row.storageKey.trim()) ||
    (typeof row.s3Key === 'string' && row.s3Key.trim()) ||
    '';
  const filename =
    (typeof row.filename === 'string' && row.filename.trim()) ||
    (typeof row.name === 'string' && row.name.trim()) ||
    '';
  if (!storageKey || !filename) return null;
  return {
    storageKey,
    filename,
    mimeType: typeof row.mimeType === 'string' ? row.mimeType : undefined,
    size: typeof row.size === 'number' ? row.size : undefined,
  };
}

export function normalizePassportDraftUploads(
  value: unknown
): Record<string, PassportDraftUpload> {
  if (!value || typeof value !== 'object') return {};
  const out: Record<string, PassportDraftUpload> = {};
  for (const [slotKey, entry] of Object.entries(
    value as Record<string, unknown>
  )) {
    const normalized = normalizePassportDraftUpload(entry);
    if (normalized) out[slotKey] = normalized;
  }
  return out;
}
