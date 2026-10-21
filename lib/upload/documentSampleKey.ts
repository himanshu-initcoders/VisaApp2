/**
 * Canonical object keys for admin document-type sample files.
 *
 * document-samples/{slug}/sample-{uuid}.{ext}
 */

import {
  extensionFromMime,
  sanitizeExtension,
  sanitizePathSegment,
  sanitizeSlotKey,
} from './applicationKey';

export const DOCUMENT_SAMPLE_UPLOAD_FOLDER = 'document-samples' as const;

export const DOCUMENT_SAMPLE_ALLOWED_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

export function maxSampleSizeMb(mimeType: string): number {
  return mimeType === 'application/pdf' ? 10 : 5;
}

export function buildDocumentSampleObjectKey(input: {
  slug: string;
  ext: string;
  uuid?: string;
}): string {
  const slug = sanitizeSlotKey(input.slug);
  const ext = sanitizeExtension(input.ext);
  const id = sanitizePathSegment(input.uuid || crypto.randomUUID());
  return [
    DOCUMENT_SAMPLE_UPLOAD_FOLDER,
    slug,
    `sample-${id}.${ext}`,
  ].join('/');
}

export function documentSamplePublicId(objectKey: string): string {
  return objectKey.replace(/\.[^/.]+$/, '');
}

export function sampleExtensionFromUpload(mimeType: string, filename?: string): string {
  return extensionFromMime(mimeType, filename);
}
