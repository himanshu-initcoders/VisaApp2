/**
 * Client helper: gather IndexDB blobs for submit as base64 payloads.
 */

import type { ApplyTraveller } from '@/lib/apply/types';
import type { ApplicationDocumentUploadItem } from '@/lib/upload/application-actions';
import {
  PASSPORT_BACK_SLOT,
  PASSPORT_FRONT_SLOT,
  clearListingFiles,
  getFile,
  isIdbAvailable,
} from '@/lib/apply/idbDraftStorage';
import { clearApplyDraft } from '@/lib/apply/draftStorage';

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/**
 * Collect all IndexDB files for travellers into upload items.
 */
export async function collectIdbFilesForSubmit(
  listingId: string,
  travellers: ApplyTraveller[]
): Promise<ApplicationDocumentUploadItem[]> {
  if (!isIdbAvailable()) return [];

  const items: ApplicationDocumentUploadItem[] = [];
  const seen = new Set<string>();

  async function pushSlot(passengerId: string, slotKey: string) {
    const dedupe = `${passengerId}:${slotKey}`;
    if (seen.has(dedupe)) return;
    const record = await getFile(listingId, passengerId, slotKey);
    if (!record?.blob) return;
    seen.add(dedupe);
    items.push({
      passengerId,
      slotKey,
      filename: record.filename || `${slotKey}.bin`,
      mimeType: record.mimeType || 'application/octet-stream',
      bufferBase64: await blobToBase64(record.blob),
    });
  }

  for (const traveller of travellers) {
    await pushSlot(traveller.id, PASSPORT_FRONT_SLOT);
    await pushSlot(traveller.id, PASSPORT_BACK_SLOT);
    for (const doc of traveller.documents ?? []) {
      if (doc.key) {
        await pushSlot(traveller.id, doc.key);
      }
    }
  }

  return items;
}

/** Clear local draft + IndexDB files after successful submit. */
export async function clearLocalDraftAfterSubmit(listingId: string) {
  clearApplyDraft(listingId);
  if (isIdbAvailable()) {
    try {
      await clearListingFiles(listingId);
    } catch {
      // ignore leftover IndexDB cleanup errors
    }
  }
}
