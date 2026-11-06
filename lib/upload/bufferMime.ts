import type { UploadOptions } from '@/lib/upload/types';

/** MIME for a Buffer upload. File uploads already carry their own type. */
export function mimeTypeForBufferUpload(
  options: Pick<UploadOptions, 'mimeType' | 'allowedTypes'>,
  filename: string
): string {
  const explicit = options.mimeType?.split(';')[0]?.trim().toLowerCase();
  if (explicit && explicit !== 'application/octet-stream') return explicit;

  const lower = filename.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';

  return options.allowedTypes?.[0] || 'application/octet-stream';
}
