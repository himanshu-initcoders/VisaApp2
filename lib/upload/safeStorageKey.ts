/**
 * Path-safe storage key helpers for local disk reads.
 */

import path from 'path';

export const UPLOADS_ROOT = path.join(process.cwd(), 'public', 'uploads');

/**
 * Normalize and validate an object storage key before filesystem access.
 * Rejects traversal, absolute paths, and escapes outside uploads root.
 */
export function assertSafeStorageKey(storageKey: string): string {
  const trimmed = storageKey.trim().replace(/\\/g, '/');
  if (!trimmed) {
    throw new Error('Document key missing');
  }
  if (trimmed.startsWith('/') || /^[a-zA-Z]:/.test(trimmed)) {
    throw new Error('Invalid document key');
  }
  if (trimmed.includes('..') || trimmed.includes('\0')) {
    throw new Error('Invalid document key');
  }
  if (!trimmed.startsWith('applications/')) {
    throw new Error('Invalid document key');
  }

  const resolved = path.resolve(UPLOADS_ROOT, trimmed);
  const rootResolved = path.resolve(UPLOADS_ROOT);
  if (
    resolved !== rootResolved &&
    !resolved.startsWith(rootResolved + path.sep)
  ) {
    throw new Error('Invalid document key');
  }

  return trimmed;
}
