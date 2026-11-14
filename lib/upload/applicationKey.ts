/**
 * Canonical object keys for applicant documents (S3 / Cloudinary / local).
 *
 * Draft and submitted applications share the same path (status lives in DB):
 * applications/{countryCode}/{listingId}/{userId}/{applicationId}/passengers/{passengerId}/{slotKey}.{ext}
 */

export interface ApplicationObjectKeyInput {
  countryCode: string;
  listingId: string;
  userId: string;
  applicationId: string;
  passengerId: string;
  slotKey: string;
  ext: string;
}

/** Sanitize slot keys to [a-z0-9_-]. */
export function sanitizeSlotKey(slotKey: string): string {
  const cleaned = slotKey
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return cleaned || 'document';
}

export function sanitizePathSegment(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '') || 'unknown';
}

export function sanitizeExtension(ext: string): string {
  const cleaned = ext.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  return cleaned || 'bin';
}

export function extensionFromMime(mimeType: string, filename?: string): string {
  // Prefer authoritative MIME over filename. A PDF replaced onto a slot that
  // previously used `passport-back.jpg` must not keep the .jpg key.
  const mime = (mimeType || '').split(';')[0]?.trim().toLowerCase();
  if (mime === 'application/pdf') return 'pdf';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/jpeg' || mime === 'image/jpg') return 'jpg';
  if (filename) {
    const match = filename.match(/\.([a-z0-9]+)$/i);
    if (match) return sanitizeExtension(match[1]);
  }
  const subtype = mime.split('/')[1];
  return sanitizeExtension(subtype || 'bin');
}

/**
 * Full storage key including extension (S3 / local).
 * Cloudinary public_id should use {@link applicationPublicId} (no extension).
 */
export function buildApplicationObjectKey(input: ApplicationObjectKeyInput): string {
  const countryCode = sanitizePathSegment(input.countryCode).toUpperCase();
  const listingId = sanitizePathSegment(input.listingId);
  const userId = sanitizePathSegment(input.userId);
  const applicationId = sanitizePathSegment(input.applicationId);
  const passengerId = sanitizePathSegment(input.passengerId);
  const slotKey = sanitizeSlotKey(input.slotKey);
  const ext = sanitizeExtension(input.ext);

  return [
    'applications',
    countryCode,
    listingId,
    userId,
    applicationId,
    'passengers',
    passengerId,
    `${slotKey}.${ext}`,
  ].join('/');
}

/** True when key belongs to this user + application under applications/. */
export function isApplicationObjectKey(
  key: string,
  userId: string,
  applicationId: string
): boolean {
  const userSeg = sanitizePathSegment(userId);
  const appSeg = sanitizePathSegment(applicationId);
  const marker = `/${userSeg}/${appSeg}/`;
  return key.startsWith('applications/') && key.includes(marker);
}

/**
 * @deprecated Legacy /drafts/ path — kept only for reading abandoned keys.
 */
export function isDraftObjectKey(key: string, userId: string): boolean {
  const segment = `/${sanitizePathSegment(userId)}/drafts/`;
  return key.includes(segment) && key.startsWith('applications/');
}

export interface DraftObjectKeyInput {
  countryCode: string;
  listingId: string;
  userId: string;
  passengerId: string;
  slotKey: string;
  ext: string;
}

/**
 * @deprecated Prefer {@link buildApplicationObjectKey} with a draft application id.
 * Kept so transitional callers can still compile until fully migrated.
 */
export function buildDraftObjectKey(input: DraftObjectKeyInput): string {
  const countryCode = sanitizePathSegment(input.countryCode).toUpperCase();
  const listingId = sanitizePathSegment(input.listingId);
  const userId = sanitizePathSegment(input.userId);
  const passengerId = sanitizePathSegment(input.passengerId);
  const slotKey = sanitizeSlotKey(input.slotKey);
  const ext = sanitizeExtension(input.ext);

  return [
    'applications',
    countryCode,
    listingId,
    userId,
    'drafts',
    'passengers',
    passengerId,
    `${slotKey}.${ext}`,
  ].join('/');
}

/** Cloudinary public_id — same path without file extension. */
export function applicationPublicId(objectKey: string): string {
  return objectKey.replace(/\.[^/.]+$/, '');
}

export const APPLICATION_UPLOAD_FOLDER = 'applications' as const;
