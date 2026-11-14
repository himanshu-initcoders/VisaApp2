/**
 * Server-side: copy past application files into the current listing draft.
 * Browser only receives draft storage keys + media URLs (no base64 / IndexedDB).
 */

import type { PassengerAutofillPayload } from '@/lib/apply/previousProfilesAutofill';
import { copyOwnedFileToDraft } from '@/lib/upload/copyOwnedFileToDraft';
import {
  PASSPORT_BACK_SLOT,
  PASSPORT_FRONT_SLOT,
} from '@/lib/apply/idbDraftStorage';

export async function stageAutofillDocumentsToDraft(input: {
  userId: string;
  countryCode: string;
  listingId: string;
  applicationId: string;
  travellerId: string;
  payload: PassengerAutofillPayload;
}): Promise<PassengerAutofillPayload> {
  const failedSlots: string[] = [];
  const stagedDocs: PassengerAutofillPayload['documents'] = [];
  const draftFileRefs: NonNullable<PassengerAutofillPayload['draftFileRefs']> =
    [];
  let passportFrontUrl: string | null = null;
  let passportBackUrl: string | null = null;

  for (const ref of input.payload.documents) {
    if (!ref.storageKey) {
      failedSlots.push(ref.slotKey);
      continue;
    }

    try {
      const copied = await copyOwnedFileToDraft({
        sourceStorageKey: ref.storageKey,
        countryCode: input.countryCode,
        listingId: input.listingId,
        userId: input.userId,
        applicationId: input.applicationId,
        passengerId: input.travellerId,
        slotKey: ref.slotKey,
        filename: ref.filename,
        mimeType: ref.mimeType,
      });

      if (!copied) {
        failedSlots.push(ref.slotKey);
        continue;
      }

      draftFileRefs.push({
        slotKey: ref.slotKey,
        storageKey: copied.storageKey,
        url: copied.storageUrl,
        mimeType: copied.mimeType,
        filename: copied.filename,
        size: copied.size,
      });

      if (ref.role === 'passport-front' || ref.slotKey === PASSPORT_FRONT_SLOT) {
        passportFrontUrl = copied.storageUrl;
        continue;
      }

      if (ref.role === 'passport-back' || ref.slotKey === PASSPORT_BACK_SLOT) {
        passportBackUrl = copied.storageUrl;
        // Passport back is also a Documents-tab slot on many listings.
        stagedDocs.push({
          ...ref,
          storageKey: copied.storageKey,
          storageUrl: copied.storageUrl,
          filename: copied.filename,
          mimeType: copied.mimeType,
          size: copied.size,
          role: 'passport-back',
        });
        continue;
      }

      stagedDocs.push({
        ...ref,
        storageKey: copied.storageKey,
        storageUrl: copied.storageUrl,
        filename: copied.filename,
        mimeType: copied.mimeType,
        size: copied.size,
      });
    } catch {
      failedSlots.push(ref.slotKey);
    }
  }

  return {
    ...input.payload,
    documents: stagedDocs,
    draftFileRefs,
    passportFrontUrl,
    passportBackUrl,
    failedSlots,
  };
}
