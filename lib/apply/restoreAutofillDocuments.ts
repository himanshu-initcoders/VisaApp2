/**
 * Restore autofilled document blobs into the current listing's IndexedDB.
 */

import {
  PASSPORT_BACK_SLOT,
  PASSPORT_FRONT_SLOT,
  isIdbAvailable,
  putFile,
} from '@/lib/apply/idbDraftStorage';
import type { TravellerDocumentUpload } from '@/lib/apply/applicationForm';
import type { AutofillDocumentRef } from '@/lib/apply/previousProfilesAutofill';
import { fetchMyDocumentBlob } from '@/app/visa/actions';

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType || 'application/octet-stream' });
}

export type RestoredAutofillDocs = {
  passportFrontUrl?: string;
  passportBackUrl?: string;
  passportUploaded: boolean;
  photoUploaded: boolean;
  documents: TravellerDocumentUpload[];
  failedSlots: string[];
};

/**
 * Download owned prior documents and store them under the new traveller id.
 */
export async function restoreAutofillDocumentsToIdb(input: {
  listingId: string;
  travellerId: string;
  refs: AutofillDocumentRef[];
}): Promise<RestoredAutofillDocs> {
  const result: RestoredAutofillDocs = {
    passportUploaded: false,
    photoUploaded: false,
    documents: [],
    failedSlots: [],
  };

  if (!isIdbAvailable() || input.refs.length === 0) {
    result.failedSlots = input.refs.map((r) => r.slotKey);
    return result;
  }

  for (const ref of input.refs) {
    try {
      const fetched = await fetchMyDocumentBlob({
        documentDbId: ref.documentDbId,
        storageKey: ref.storageKey,
      });
      if (!fetched.success || !fetched.data) {
        result.failedSlots.push(ref.slotKey);
        continue;
      }

      const mimeType = fetched.data.mimeType || ref.mimeType || 'application/octet-stream';
      const filename = fetched.data.filename || ref.filename || `${ref.slotKey}.bin`;
      const blob = base64ToBlob(fetched.data.base64, mimeType);

      await putFile(input.listingId, input.travellerId, ref.slotKey, {
        blob,
        mimeType,
        filename,
      });

      const previewUrl = URL.createObjectURL(blob);

      if (ref.slotKey === PASSPORT_FRONT_SLOT) {
        result.passportFrontUrl = previewUrl;
        result.passportUploaded = true;
        continue;
      }
      if (ref.slotKey === PASSPORT_BACK_SLOT) {
        result.passportBackUrl = previewUrl;
        result.passportUploaded = true;
        continue;
      }
      if (ref.slotKey === 'photo') {
        result.photoUploaded = true;
      }

      result.documents.push({
        key: ref.slotKey,
        name: filename,
        mimeType,
        size: blob.size,
        storedInIdb: true,
        previewUrl,
      });
    } catch {
      result.failedSlots.push(ref.slotKey);
    }
  }

  return result;
}
