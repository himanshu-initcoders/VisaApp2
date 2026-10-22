/**
 * Promote a draft storage object to an application object key.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { uploadService } from '@/lib/upload';
import {
  APPLICATION_UPLOAD_FOLDER,
  buildApplicationObjectKey,
  extensionFromMime,
  isDraftObjectKey,
} from '@/lib/upload/applicationKey';
import {
  UPLOADS_ROOT,
  assertSafeStorageKey,
} from '@/lib/upload/safeStorageKey';

export interface PromoteDraftFileInput {
  draftStorageKey: string;
  countryCode: string;
  listingId: string;
  userId: string;
  applicationId: string;
  passengerId: string;
  slotKey: string;
  filename?: string;
  mimeType?: string;
}

export interface PromoteDraftFileResult {
  key: string;
  url: string;
  mimeType: string;
  filename: string;
  size: number;
}

async function readObjectBuffer(
  storageKey: string
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const safeKey = assertSafeStorageKey(storageKey);

  if (uploadService.getProviderName() === 'local') {
    try {
      const filePath = path.join(UPLOADS_ROOT, safeKey);
      const buffer = await fs.readFile(filePath);
      return { buffer, mimeType: 'application/octet-stream' };
    } catch {
      return null;
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
    mimeType: response.headers.get('content-type') || 'application/octet-stream',
  };
}

/**
 * Copy/rename a draft key into the application path. Deletes the draft object on success.
 */
export async function promoteDraftFileToApplication(
  input: PromoteDraftFileInput
): Promise<PromoteDraftFileResult> {
  const draftKey = assertSafeStorageKey(input.draftStorageKey);
  if (!isDraftObjectKey(draftKey, input.userId)) {
    throw new Error('Not a draft file for this user');
  }

  const filename =
    input.filename || draftKey.split('/').pop() || `${input.slotKey}.bin`;
  let mimeType = input.mimeType || 'application/octet-stream';
  if (!input.mimeType) {
    if (filename.endsWith('.pdf')) mimeType = 'application/pdf';
    else if (filename.endsWith('.png')) mimeType = 'image/png';
    else if (filename.endsWith('.webp')) mimeType = 'image/webp';
    else if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) {
      mimeType = 'image/jpeg';
    }
  }

  const ext = extensionFromMime(mimeType, filename);
  const explicitKey = buildApplicationObjectKey({
    countryCode: input.countryCode,
    listingId: input.listingId,
    userId: input.userId,
    applicationId: input.applicationId,
    passengerId: input.passengerId,
    slotKey: input.slotKey,
    ext,
  });

  // Local: try hard rename (same volume) for speed
  if (uploadService.getProviderName() === 'local') {
    const src = path.join(UPLOADS_ROOT, draftKey);
    const dest = path.join(UPLOADS_ROOT, explicitKey);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    try {
      await fs.rename(src, dest);
      try {
        await fs.rename(`${src}.meta.json`, `${dest}.meta.json`);
      } catch {
        // meta optional
      }
      const stat = await fs.stat(dest);
      return {
        key: explicitKey,
        url: uploadService.getUrl(explicitKey),
        mimeType,
        filename,
        size: stat.size,
      };
    } catch {
      // fall through to copy via buffer
    }
  }

  const read = await readObjectBuffer(draftKey);
  if (!read) {
    throw new Error('Draft file not found');
  }
  if (mimeType === 'application/octet-stream' && read.mimeType) {
    mimeType = read.mimeType;
  }

  const result = await uploadService.upload(read.buffer, {
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
      applicationId: input.applicationId,
      listingId: input.listingId,
      promotedFrom: draftKey,
    },
  });

  try {
    await uploadService.delete({ key: draftKey });
  } catch (error) {
    console.warn('[Upload] Failed to delete draft after promote:', draftKey, error);
  }

  return {
    key: result.key,
    url: result.url,
    mimeType: result.mimeType || mimeType,
    filename: result.filename || filename,
    size: result.size,
  };
}
