/**
 * Client helper: gather IndexedDB blobs / draft storage keys for submit.
 */

import type { ApplyTraveller } from '@/lib/apply/types';
import type { DraftScopeInput } from '@/lib/apply/draftScope';
import type { ApplicationDocumentUploadItem } from '@/lib/upload/application-actions';
import {
  PASSPORT_BACK_SLOT,
  PASSPORT_FRONT_SLOT,
  getFile,
  isIdbAvailable,
} from '@/lib/apply/idbDraftStorage';
import { clearApplyDraftAsync } from '@/lib/apply/draftStorage';

export interface DraftStorageKeyItem {
  passengerId: string;
  slotKey: string;
  storageKey: string;
  filename?: string;
  mimeType?: string;
  size?: number;
}

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

function normalizeScope(
  listingIdOrScope: string | DraftScopeInput,
  maybeScope?: Omit<DraftScopeInput, 'listingId'>
): DraftScopeInput {
  if (typeof listingIdOrScope === 'string') {
    return {
      listingId: listingIdOrScope,
      sessionUserId: maybeScope?.sessionUserId ?? null,
      onBehalfOfUserId: maybeScope?.onBehalfOfUserId ?? null,
    };
  }
  return listingIdOrScope;
}

/** Prefer server draft keys when present (promote path). */
export function collectDraftStorageKeysForSubmit(
  travellers: ApplyTraveller[]
): DraftStorageKeyItem[] {
  const items: DraftStorageKeyItem[] = [];
  const seen = new Set<string>();

  for (const traveller of travellers) {
    const refs: Array<{
      slotKey: string;
      storageKey: string;
      filename?: string;
      mimeType?: string;
      size?: number;
    }> = [
      ...(traveller.draftFileRefs ?? []),
      ...(traveller.documents ?? [])
        .filter((d) => d.storageKey)
        .map((d) => ({
          slotKey: d.key,
          storageKey: d.storageKey!,
          filename: d.name,
          mimeType: d.mimeType,
          size: d.size,
        })),
    ];

    for (const ref of refs) {
      if (!ref.storageKey) continue;
      const dedupe = `${traveller.id}:${ref.slotKey}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      items.push({
        passengerId: traveller.id,
        slotKey: ref.slotKey,
        storageKey: ref.storageKey,
        filename: ref.filename,
        mimeType: ref.mimeType,
        size: ref.size,
      });
    }
  }

  return items;
}

/**
 * Collect IndexedDB files that do not already have a server draft key.
 * Used as fallback when promote keys are incomplete.
 */
export async function collectIdbFilesForSubmit(
  listingIdOrScope: string | DraftScopeInput,
  travellers: ApplyTraveller[],
  maybeScope?: Omit<DraftScopeInput, 'listingId'>
): Promise<ApplicationDocumentUploadItem[]> {
  if (!isIdbAvailable()) return [];
  const scope = normalizeScope(listingIdOrScope, maybeScope);
  const promoted = new Set(
    collectDraftStorageKeysForSubmit(travellers).map(
      (r) => `${r.passengerId}:${r.slotKey}`
    )
  );

  const items: ApplicationDocumentUploadItem[] = [];
  const seen = new Set<string>();

  async function pushSlot(passengerId: string, slotKey: string) {
    const dedupe = `${passengerId}:${slotKey}`;
    if (seen.has(dedupe) || promoted.has(dedupe)) return;
    const record = await getFile(scope, passengerId, slotKey);
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

/** Clear scoped local draft + IDB files after successful submit. */
export async function clearLocalDraftAfterSubmit(
  listingIdOrScope: string | DraftScopeInput,
  maybeScope?: Omit<DraftScopeInput, 'listingId'>
) {
  await clearApplyDraftAsync(listingIdOrScope, maybeScope);
}
