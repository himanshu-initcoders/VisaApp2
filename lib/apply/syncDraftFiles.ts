/**
 * Sync IndexedDB apply files to server draft storage via multipart API.
 */

'use client';

import type { ApplyTraveller, DraftFileRef } from '@/lib/apply/types';
import type { DraftScopeInput } from '@/lib/apply/draftScope';
import {
  collectDraftStorageKeysForSubmit,
  findUnsyncedIdbSlotsError,
  type DraftStorageKeyItem,
} from '@/lib/apply/collectSubmitFiles';
import {
  type ApplyDraft,
  writeApplyDraftAsync,
} from '@/lib/apply/draftStorage';
import {
  PASSPORT_BACK_SLOT,
  PASSPORT_FRONT_SLOT,
  getFile,
  isIdbAvailable,
  putFile,
} from '@/lib/apply/idbDraftStorage';

/** Slot already has a server key and the local document was not replaced. */
function slotAlreadySynced(traveller: ApplyTraveller, slotKey: string): boolean {
  const ref = traveller.draftFileRefs?.find((r) => r.slotKey === slotKey);
  const doc = traveller.documents?.find((d) => d.key === slotKey);

  // Local replace clears storageKey on the document — must re-upload.
  if (doc && !doc.storageKey) return false;

  if (doc?.storageKey) {
    return !ref?.storageKey || ref.storageKey === doc.storageKey;
  }

  // Passport (and similar) slots tracked only via draftFileRefs.
  return Boolean(ref?.storageKey);
}

function mergeDraftFileRefs(
  travellers: ApplyTraveller[],
  results: Array<{
    passengerId: string;
    slotKey: string;
    key: string;
    url: string;
    mimeType: string;
    filename: string;
    size: number;
  }>
): ApplyTraveller[] {
  const byPassenger = new Map<string, typeof results>();
  for (const item of results) {
    const list = byPassenger.get(item.passengerId) ?? [];
    list.push(item);
    byPassenger.set(item.passengerId, list);
  }

  return travellers.map((traveller) => {
    const uploaded = byPassenger.get(traveller.id);
    if (!uploaded?.length) return traveller;

    const refMap = new Map<string, DraftFileRef>(
      (traveller.draftFileRefs ?? []).map((ref) => [ref.slotKey, ref])
    );
    for (const item of uploaded) {
      refMap.set(item.slotKey, {
        slotKey: item.slotKey,
        storageKey: item.key,
        url: item.url,
        mimeType: item.mimeType,
        filename: item.filename,
        size: item.size,
      });
    }

    const documents = (traveller.documents ?? []).map((doc) => {
      const ref = refMap.get(doc.key);
      if (!ref) return doc;
      return {
        ...doc,
        storageKey: ref.storageKey,
        storageUrl: ref.url,
        mimeType: ref.mimeType || doc.mimeType,
        name: ref.filename || doc.name,
        size: ref.size ?? doc.size,
      };
    });

    return {
      ...traveller,
      draftFileRefs: Array.from(refMap.values()),
      documents,
      passportUploaded:
        traveller.passportUploaded ||
        refMap.has(PASSPORT_FRONT_SLOT) ||
        refMap.has(PASSPORT_BACK_SLOT),
      photoUploaded: traveller.photoUploaded || refMap.has('photo'),
    };
  });
}

async function listIdbSlots(
  scope: DraftScopeInput,
  travellers: ApplyTraveller[]
): Promise<Array<{ passengerId: string; slotKey: string; blob: Blob; mimeType: string; filename: string }>> {
  if (!isIdbAvailable()) return [];
  const items: Array<{
    passengerId: string;
    slotKey: string;
    blob: Blob;
    mimeType: string;
    filename: string;
  }> = [];
  const seen = new Set<string>();

  async function push(traveller: ApplyTraveller, slotKey: string) {
    const dedupe = `${traveller.id}:${slotKey}`;
    if (seen.has(dedupe)) return;
    if (slotAlreadySynced(traveller, slotKey)) return;
    const record = await getFile(scope, traveller.id, slotKey);
    if (!record?.blob) return;
    seen.add(dedupe);
    items.push({
      passengerId: traveller.id,
      slotKey,
      blob: record.blob,
      mimeType: record.mimeType || 'application/octet-stream',
      filename: record.filename || `${slotKey}.bin`,
    });
  }

  for (const traveller of travellers) {
    await push(traveller, PASSPORT_FRONT_SLOT);
    await push(traveller, PASSPORT_BACK_SLOT);
    for (const doc of traveller.documents ?? []) {
      if (doc.key) await push(traveller, doc.key);
    }
  }
  return items;
}

/**
 * Upload local IDB files for this listing draft via FormData (no Base64).
 */
export async function syncDraftFilesToServer(input: {
  listingId: string;
  countryCode: string;
  travellers: ApplyTraveller[];
  ownerUserId?: string;
  sessionUserId?: string | null;
}): Promise<
  | { success: true; travellers: ApplyTraveller[]; uploadedCount: number }
  | { success: false; error: string; travellers: ApplyTraveller[] }
> {
  const scope: DraftScopeInput = {
    listingId: input.listingId,
    sessionUserId: input.sessionUserId ?? null,
    onBehalfOfUserId: input.ownerUserId ?? null,
  };

  const files = await listIdbSlots(scope, input.travellers);
  if (files.length === 0) {
    return {
      success: true,
      travellers: input.travellers,
      uploadedCount: 0,
    };
  }

  const results: Array<{
    passengerId: string;
    slotKey: string;
    key: string;
    url: string;
    mimeType: string;
    filename: string;
    size: number;
  }> = [];

  for (const file of files) {
    const form = new FormData();
    form.set('listingId', input.listingId);
    form.set('countryCode', input.countryCode);
    form.set('passengerId', file.passengerId);
    form.set('slotKey', file.slotKey);
    if (input.ownerUserId) form.set('ownerUserId', input.ownerUserId);
    form.set(
      'file',
      new File([file.blob], file.filename, { type: file.mimeType })
    );

    const response = await fetch('/api/apply/draft-files', {
      method: 'POST',
      body: form,
    });
    const json = (await response.json().catch(() => null)) as {
      success?: boolean;
      result?: (typeof results)[number];
      error?: string;
    } | null;

    if (!response.ok || !json?.success || !json.result) {
      return {
        success: false,
        error: json?.error || 'Draft file upload failed',
        travellers: input.travellers,
      };
    }
    results.push(json.result);
  }

  return {
    success: true,
    travellers: mergeDraftFileRefs(input.travellers, results),
    uploadedCount: results.length,
  };
}

/**
 * Before checkout/submit: upload any unsynced IDB files via FormData,
 * persist draft keys locally, and return key-only payload for Server Actions.
 */
export async function prepareDraftFilesForSubmit(input: {
  draft: ApplyDraft;
  draftScope: DraftScopeInput;
  countryCode: string;
}): Promise<
  | {
      success: true;
      travellers: ApplyTraveller[];
      draftStorageKeys: DraftStorageKeyItem[];
      uploadedCount: number;
    }
  | { success: false; error: string }
> {
  const ownerUserId = input.draftScope.onBehalfOfUserId ?? undefined;
  const sync = await syncDraftFilesToServer({
    listingId: input.draft.listingId,
    countryCode: input.countryCode,
    travellers: input.draft.travellers,
    ownerUserId,
    sessionUserId: input.draftScope.sessionUserId,
  });

  if (!sync.success) {
    return {
      success: false,
      error: sync.error || 'Could not upload documents. Try again.',
    };
  }

  const travellers = sync.travellers;
  const unsynced = await findUnsyncedIdbSlotsError(
    input.draftScope,
    travellers
  );
  if (unsynced) {
    return { success: false, error: unsynced };
  }

  await writeApplyDraftAsync(
    {
      ...input.draft,
      travellers,
    },
    {
      sessionUserId: input.draftScope.sessionUserId,
      onBehalfOfUserId: input.draftScope.onBehalfOfUserId,
    }
  );

  return {
    success: true,
    travellers,
    draftStorageKeys: collectDraftStorageKeysForSubmit(travellers),
    uploadedCount: sync.uploadedCount,
  };
}

/**
 * Download draft files from server into IndexedDB when missing locally.
 */
export async function restoreDraftFilesToIdb(input: {
  listingId: string;
  travellers: ApplyTraveller[];
  ownerUserId?: string;
  sessionUserId?: string | null;
}): Promise<ApplyTraveller[]> {
  if (!isIdbAvailable()) return input.travellers;

  const scope: DraftScopeInput = {
    listingId: input.listingId,
    sessionUserId: input.sessionUserId ?? null,
    onBehalfOfUserId: input.ownerUserId ?? null,
  };

  const next: ApplyTraveller[] = [];

  for (const traveller of input.travellers) {
    const refs = traveller.draftFileRefs ?? [];
    const fromDocs: DraftFileRef[] = (traveller.documents ?? [])
      .filter((doc) => doc.storageKey)
      .map((doc) => ({
        slotKey: doc.key,
        storageKey: doc.storageKey!,
        url: doc.storageUrl,
        mimeType: doc.mimeType,
        filename: doc.name,
        size: doc.size,
      }));

    const refMap = new Map<string, DraftFileRef>();
    for (const ref of [...fromDocs, ...refs]) {
      refMap.set(ref.slotKey, ref);
    }

    let passportFrontUrl = traveller.passportFrontUrl;
    let passportBackUrl = traveller.passportBackUrl;
    let passportUploaded = traveller.passportUploaded;
    let photoUploaded = traveller.photoUploaded;
    const documents = [...(traveller.documents ?? [])];

    for (const ref of refMap.values()) {
      try {
        const existing = await getFile(scope, traveller.id, ref.slotKey);
        if (existing?.blob) {
          const previewUrl = URL.createObjectURL(existing.blob);
          if (ref.slotKey === PASSPORT_FRONT_SLOT) {
            passportFrontUrl = previewUrl;
            passportUploaded = true;
          } else if (ref.slotKey === PASSPORT_BACK_SLOT) {
            passportBackUrl = previewUrl;
            passportUploaded = true;
          } else {
            const idx = documents.findIndex((d) => d.key === ref.slotKey);
            if (idx >= 0) {
              documents[idx] = {
                ...documents[idx]!,
                storedInIdb: true,
                previewUrl,
                storageKey: ref.storageKey,
                storageUrl: ref.url,
                mimeType: existing.mimeType || documents[idx]!.mimeType,
                name: existing.filename || documents[idx]!.name,
                size: existing.size || documents[idx]!.size,
              };
            }
          }
          continue;
        }

        const params = new URLSearchParams({
          storageKey: ref.storageKey,
        });
        if (input.ownerUserId) {
          params.set('ownerUserId', input.ownerUserId);
        }
        const response = await fetch(
          `/api/apply/draft-files?${params.toString()}`
        );
        if (!response.ok) continue;

        const blob = await response.blob();
        const mimeType =
          response.headers.get('content-type') ||
          ref.mimeType ||
          'application/octet-stream';
        const filename = ref.filename || `${ref.slotKey}.bin`;
        await putFile(scope, traveller.id, ref.slotKey, {
          blob,
          mimeType,
          filename,
        });
        const previewUrl = URL.createObjectURL(blob);

        if (ref.slotKey === PASSPORT_FRONT_SLOT) {
          passportFrontUrl = previewUrl;
          passportUploaded = true;
        } else if (ref.slotKey === PASSPORT_BACK_SLOT) {
          passportBackUrl = previewUrl;
          passportUploaded = true;
        } else if (ref.slotKey === 'photo') {
          photoUploaded = true;
          const idx = documents.findIndex((d) => d.key === ref.slotKey);
          if (idx >= 0) {
            documents[idx] = {
              ...documents[idx]!,
              storedInIdb: true,
              previewUrl,
              storageKey: ref.storageKey,
              storageUrl: ref.url,
              mimeType,
              name: filename,
              size: blob.size,
            };
          } else {
            documents.push({
              key: ref.slotKey,
              name: filename,
              mimeType,
              size: blob.size,
              storedInIdb: true,
              previewUrl,
              storageKey: ref.storageKey,
              storageUrl: ref.url,
            });
          }
        } else {
          const idx = documents.findIndex((d) => d.key === ref.slotKey);
          if (idx >= 0) {
            documents[idx] = {
              ...documents[idx]!,
              storedInIdb: true,
              previewUrl,
              storageKey: ref.storageKey,
              storageUrl: ref.url,
              mimeType,
              name: filename,
              size: blob.size,
            };
          } else {
            documents.push({
              key: ref.slotKey,
              name: filename,
              mimeType,
              size: blob.size,
              storedInIdb: true,
              previewUrl,
              storageKey: ref.storageKey,
              storageUrl: ref.url,
            });
          }
        }
      } catch {
        // leave slot unrestored
      }
    }

    next.push({
      ...traveller,
      passportFrontUrl,
      passportBackUrl,
      passportUploaded,
      photoUploaded,
      documents,
      draftFileRefs: Array.from(refMap.values()),
    });
  }

  return next;
}
