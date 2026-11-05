/**
 * Copy an owned application/storage object into the current listing draft path.
 * Used by previous-profile autofill so the browser never base64-downloads files.
 */

import { uploadService } from '@/lib/upload';
import {
  APPLICATION_UPLOAD_FOLDER,
  buildDraftObjectKey,
  extensionFromMime,
} from '@/lib/upload/applicationKey';
import { deleteOtherSlotExtensionKeys } from '@/lib/upload/deleteSlotSiblings';
import { toAppMediaUrl } from '@/lib/upload/mediaUrl';
import { assertSafeStorageKey, UPLOADS_ROOT } from '@/lib/upload/safeStorageKey';
import { promises as fs } from 'fs';
import path from 'path';

async function readOwnedBuffer(
  storageKey: string
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const safeKey = assertSafeStorageKey(storageKey);

  if (uploadService.getProviderName() === 'local') {
    try {
      const buffer = await fs.readFile(path.join(UPLOADS_ROOT, safeKey));
      return { buffer, mimeType: guessMime(safeKey) };
    } catch {
      // fall through to URL fetch
    }
  }

  const url = uploadService.getUrl(safeKey);
  const absolute =
    url.startsWith('http') || url.startsWith('//')
      ? url
      : `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}${url.startsWith('/') ? '' : '/'}${url}`;
  const response = await fetch(absolute);
  if (!response.ok) return null;
  const arrayBuffer = await response.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    mimeType:
      response.headers.get('content-type') || guessMime(safeKey),
  };
}

function guessMime(key: string): string {
  const lower = key.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/octet-stream';
}

export type CopiedDraftFile = {
  storageKey: string;
  storageUrl: string;
  mimeType: string;
  filename: string;
  size: number;
};

export async function copyOwnedFileToDraft(input: {
  sourceStorageKey: string;
  countryCode: string;
  listingId: string;
  userId: string;
  passengerId: string;
  slotKey: string;
  filename?: string | null;
  mimeType?: string | null;
}): Promise<CopiedDraftFile | null> {
  const sourceKey = assertSafeStorageKey(input.sourceStorageKey);
  const read = await readOwnedBuffer(sourceKey);
  if (!read) return null;

  const mimeType =
    input.mimeType && input.mimeType !== 'application/octet-stream'
      ? input.mimeType
      : read.mimeType;
  const filename =
    input.filename?.trim() ||
    sourceKey.split('/').pop() ||
    `${input.slotKey}.bin`;
  const ext = extensionFromMime(mimeType, filename);
  const explicitKey = buildDraftObjectKey({
    countryCode: input.countryCode,
    listingId: input.listingId,
    userId: input.userId,
    passengerId: input.passengerId,
    slotKey: input.slotKey,
    ext,
  });

  const uploaded = await uploadService.upload(read.buffer, {
    folder: APPLICATION_UPLOAD_FOLDER,
    filename,
    explicitKey,
    maxSizeMB: mimeType === 'application/pdf' ? 10 : 5,
    allowedTypes: [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'application/pdf',
    ],
    metadata: {
      passengerId: input.passengerId,
      slotKey: input.slotKey,
      listingId: input.listingId,
      draft: '1',
      autofillSource: sourceKey,
      ownerUserId: input.userId,
    },
  });

  await deleteOtherSlotExtensionKeys(uploaded.key);

  return {
    storageKey: uploaded.key,
    storageUrl:
      toAppMediaUrl(uploaded.url) ||
      toAppMediaUrl(uploaded.key) ||
      uploaded.url,
    mimeType: uploaded.mimeType || mimeType,
    filename: uploaded.filename || filename,
    size: uploaded.size || read.buffer.length,
  };
}
