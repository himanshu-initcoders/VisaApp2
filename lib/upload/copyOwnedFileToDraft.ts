/**
 * Copy an owned application/storage object into the current draft application path.
 * Used by previous-profile autofill so the browser never base64-downloads files.
 */

import { uploadService } from '@/lib/upload';
import {
  APPLICATION_UPLOAD_FOLDER,
  buildApplicationObjectKey,
  extensionFromMime,
} from '@/lib/upload/applicationKey';
import { deleteOtherSlotExtensionKeys } from '@/lib/upload/deleteSlotSiblings';
import { toAppMediaUrl } from '@/lib/upload/mediaUrl';
import { readStoredObject } from '@/lib/upload/readStoredObject';
import { assertSafeStorageKey } from '@/lib/upload/safeStorageKey';

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
  applicationId: string;
  passengerId: string;
  slotKey: string;
  filename?: string | null;
  mimeType?: string | null;
}): Promise<CopiedDraftFile | null> {
  const sourceKey = assertSafeStorageKey(input.sourceStorageKey);
  const read = await readStoredObject(sourceKey);
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
  const explicitKey = buildApplicationObjectKey({
    countryCode: input.countryCode,
    listingId: input.listingId,
    userId: input.userId,
    applicationId: input.applicationId,
    passengerId: input.passengerId,
    slotKey: input.slotKey,
    ext,
  });

  const uploaded = await uploadService.upload(read.buffer, {
    folder: APPLICATION_UPLOAD_FOLDER,
    filename,
    mimeType,
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
      applicationId: input.applicationId,
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
