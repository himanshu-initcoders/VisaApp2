/**
 * Canonical object keys for applicant documents (S3 / Cloudinary / local).
 *
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
  if (filename) {
    const match = filename.match(/\.([a-z0-9]+)$/i);
    if (match) return sanitizeExtension(match[1]);
  }
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') return 'jpg';
  const subtype = mimeType.split('/')[1];
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

/** Cloudinary public_id — same path without file extension. */
export function applicationPublicId(objectKey: string): string {
  return objectKey.replace(/\.[^/.]+$/, '');
}

export const APPLICATION_UPLOAD_FOLDER = 'applications' as const;
