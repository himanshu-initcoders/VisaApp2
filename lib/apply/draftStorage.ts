import type { ApplyStep, ApplyTraveller } from '@/lib/apply/types';
import type { TravellerDocumentUpload } from '@/lib/apply/applicationForm';
import {
  PASSPORT_BACK_SLOT,
  PASSPORT_FRONT_SLOT,
  createPreviewUrlFromIdb,
  deleteDraftMeta,
  getDraftMeta,
  isIdbAvailable,
  putDraftMeta,
  putFile,
  urlToBlob,
} from '@/lib/apply/idbDraftStorage';

export type { ApplyStep, ApplyTraveller };

export const APPLY_DRAFT_VERSION = 1 as const;
export const APPLY_DRAFT_PREFIX = 'visa-apply-draft:v1:';

export interface ApplyDraftDeparture {
  mode?: string;
  departure?: string;
  month?: string;
  label?: string | null;
  priceOption?: string;
}

export interface ApplyDraft {
  version: typeof APPLY_DRAFT_VERSION;
  updatedAt: string;
  countryCode: string;
  countryName: string;
  listingId: string;
  processName: string;
  step: ApplyStep;
  primaryName: string;
  travellers: ApplyTraveller[];
  departure: ApplyDraftDeparture;
  travellersCount: number;
}

function storageKey(listingId: string) {
  return `${APPLY_DRAFT_PREFIX}${listingId}`;
}

function canUseStorage() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function isBinaryUrl(url?: string) {
  if (!url) return false;
  return url.startsWith('data:') || url.startsWith('blob:');
}

function isValidDraft(parsed: unknown, listingId: string): parsed is ApplyDraft {
  if (!parsed || typeof parsed !== 'object') return false;
  const draft = parsed as ApplyDraft;
  if (draft.version !== APPLY_DRAFT_VERSION) return false;
  if (draft.listingId !== listingId) return false;
  if (!Array.isArray(draft.travellers) || draft.travellers.length === 0) {
    return false;
  }
  return true;
}

/** How much filled content a draft has — used to avoid empty overwrites. */
export function draftSubstanceScore(
  draft: Pick<ApplyDraft, 'travellers' | 'primaryName' | 'step'>
): number {
  let score = 0;
  if (draft.primaryName?.trim()) score += 1;
  if (draft.step && draft.step !== 'travellers') score += 2;
  for (const t of draft.travellers ?? []) {
    if (t.name?.trim()) score += 1;
    if (t.passportData) score += 5;
    if (t.tripDetails?.purpose || t.tripDetails?.arrivalDate) score += 3;
    if (t.applicationComplete) score += 4;
    if (t.passportUploaded) score += 2;
    score += t.documents?.length ?? 0;
  }
  return score;
}

/** Strip ephemeral UI flags and binary preview URLs before writing. */
export function serializeTravellersForDraft(
  travellers: ApplyTraveller[]
): ApplyTraveller[] {
  return travellers.map((traveller) => ({
    ...traveller,
    editing: false,
    passportFrontUrl: undefined,
    passportBackUrl: undefined,
    documents: traveller.documents?.map((doc) => ({
      key: doc.key,
      name: doc.name,
      mimeType: doc.mimeType,
      size: doc.size,
      storedInIdb: doc.storedInIdb ?? Boolean(doc.name),
    })),
  }));
}

function readLocalStorageDraft(listingId: string): ApplyDraft | null {
  if (!canUseStorage() || !listingId) return null;
  try {
    const raw = localStorage.getItem(storageKey(listingId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ApplyDraft;
    return isValidDraft(parsed, listingId) ? parsed : null;
  } catch {
    return null;
  }
}

/** Sync read (localStorage only) — prefer {@link readApplyDraftAsync} on hydrate. */
export function readApplyDraft(listingId: string): ApplyDraft | null {
  return readLocalStorageDraft(listingId);
}

/**
 * Prefer IndexedDB draft meta, fall back to localStorage.
 * Picks the richer draft if both exist (guards against empty overwrite races).
 */
export async function readApplyDraftAsync(
  listingId: string
): Promise<ApplyDraft | null> {
  const local = readLocalStorageDraft(listingId);
  let idbDraft: ApplyDraft | null = null;

  if (isIdbAvailable()) {
    try {
      const meta = await getDraftMeta(listingId);
      if (meta && isValidDraft(meta, listingId)) {
        idbDraft = meta as unknown as ApplyDraft;
      }
    } catch (error) {
      console.warn('Could not read IndexedDB draft', error);
    }
  }

  if (idbDraft && local) {
    return draftSubstanceScore(idbDraft) >= draftSubstanceScore(local)
      ? idbDraft
      : local;
  }
  return idbDraft ?? local;
}

export function hasApplyDraft(listingId: string): boolean {
  return Boolean(readApplyDraft(listingId));
}

export function writeApplyDraft(draft: ApplyDraft): void {
  void writeApplyDraftAsync(draft);
}

/** Awaitable draft write (localStorage + IndexedDB meta). */
export async function writeApplyDraftAsync(draft: ApplyDraft): Promise<void> {
  if (!draft.listingId) return;

  const payload: ApplyDraft = {
    ...draft,
    version: APPLY_DRAFT_VERSION,
    updatedAt: new Date().toISOString(),
    travellers: serializeTravellersForDraft(draft.travellers),
    travellersCount: Math.max(1, draft.travellers.length),
  };

  // Never clobber a richer saved draft with an empty shell (reload race).
  const existingLocal = readLocalStorageDraft(draft.listingId);
  if (
    existingLocal &&
    draftSubstanceScore(payload) < draftSubstanceScore(existingLocal) &&
    draftSubstanceScore(payload) <= 2
  ) {
    console.warn('Skipped empty draft overwrite');
    return;
  }

  if (canUseStorage()) {
    try {
      localStorage.setItem(storageKey(draft.listingId), JSON.stringify(payload));
    } catch (error) {
      console.warn('Could not save application draft to localStorage', error);
    }
  }

  if (isIdbAvailable()) {
    try {
      await putDraftMeta(
        draft.listingId,
        payload as unknown as Record<string, unknown>
      );
    } catch (error) {
      console.warn('Could not save application draft to IndexedDB', error);
    }
  }
}

export function clearApplyDraft(listingId: string): void {
  if (!listingId) return;
  if (canUseStorage()) {
    try {
      localStorage.removeItem(storageKey(listingId));
    } catch {
      // ignore
    }
  }
  if (isIdbAvailable()) {
    void deleteDraftMeta(listingId).catch(() => {
      // ignore
    });
  }
}

export function formatDraftUpdatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * One-shot helper: convert blob: → data: for migration into IndexedDB only.
 * Do not use for draft durability.
 */
export async function persistPreviewUrl(
  url?: string
): Promise<string | undefined> {
  if (!url) return undefined;
  if (url.startsWith('data:')) return url;
  if (!url.startsWith('blob:')) return url;
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}

async function migrateUrlToIdb(input: {
  listingId: string;
  passengerId: string;
  slotKey: string;
  url?: string;
  filename: string;
  mimeType?: string;
}): Promise<boolean> {
  if (!input.url || !isBinaryUrl(input.url)) return false;
  const blob = await urlToBlob(input.url);
  if (!blob) return false;
  await putFile(input.listingId, input.passengerId, input.slotKey, {
    blob,
    mimeType: input.mimeType || blob.type || 'application/octet-stream',
    filename: input.filename,
  });
  return true;
}

/**
 * Move legacy data:/blob: URLs from a draft into IndexedDB, then rewrite
 * storage without binaries. Returns travellers ready for UI hydration.
 */
export async function migrateLegacyDraftBinaries(
  draft: ApplyDraft
): Promise<ApplyTraveller[]> {
  if (!isIdbAvailable()) {
    return draft.travellers.map((t) => ({ ...t, editing: false }));
  }

  let migrated = false;
  const travellers: ApplyTraveller[] = [];

  for (const traveller of draft.travellers) {
    const nextDocs: TravellerDocumentUpload[] = [];

    if (
      await migrateUrlToIdb({
        listingId: draft.listingId,
        passengerId: traveller.id,
        slotKey: PASSPORT_FRONT_SLOT,
        url: traveller.passportFrontUrl,
        filename: 'passport-front.jpg',
        mimeType: 'image/jpeg',
      })
    ) {
      migrated = true;
    }

    if (
      await migrateUrlToIdb({
        listingId: draft.listingId,
        passengerId: traveller.id,
        slotKey: PASSPORT_BACK_SLOT,
        url: traveller.passportBackUrl,
        filename: 'passport-back.jpg',
        mimeType: 'image/jpeg',
      })
    ) {
      migrated = true;
    }

    for (const doc of traveller.documents ?? []) {
      const hadBinary = isBinaryUrl(doc.previewUrl);
      if (hadBinary) {
        const ok = await migrateUrlToIdb({
          listingId: draft.listingId,
          passengerId: traveller.id,
          slotKey: doc.key,
          url: doc.previewUrl,
          filename: doc.name || `${doc.key}.bin`,
          mimeType: doc.mimeType,
        });
        if (ok) migrated = true;
      }
      nextDocs.push({
        key: doc.key,
        name: doc.name,
        mimeType: doc.mimeType,
        size: doc.size,
        storedInIdb: Boolean(doc.storedInIdb || hadBinary || doc.name),
      });
    }

    travellers.push({
      ...traveller,
      editing: false,
      passportFrontUrl: undefined,
      passportBackUrl: undefined,
      documents: nextDocs,
    });
  }

  if (migrated) {
    writeApplyDraft({
      ...draft,
      travellers,
    });
  }

  return travellers;
}

/** Rehydrate ephemeral object URLs from IndexedDB for a listing draft. */
export async function rehydrateTravellerPreviews(
  listingId: string,
  travellers: ApplyTraveller[]
): Promise<ApplyTraveller[]> {
  if (!isIdbAvailable()) return travellers;

  const next: ApplyTraveller[] = [];
  for (const traveller of travellers) {
    const frontUrl = await createPreviewUrlFromIdb(
      listingId,
      traveller.id,
      PASSPORT_FRONT_SLOT
    );
    const backUrl = await createPreviewUrlFromIdb(
      listingId,
      traveller.id,
      PASSPORT_BACK_SLOT
    );

    const documents: TravellerDocumentUpload[] = [];
    for (const doc of traveller.documents ?? []) {
      const previewUrl = await createPreviewUrlFromIdb(
        listingId,
        traveller.id,
        doc.key
      );
      documents.push({
        ...doc,
        storedInIdb: doc.storedInIdb || Boolean(previewUrl),
        previewUrl,
      });
    }

    next.push({
      ...traveller,
      passportUploaded:
        traveller.passportUploaded ||
        Boolean(frontUrl) ||
        Boolean(traveller.passportData),
      passportFrontUrl: frontUrl || traveller.passportFrontUrl,
      passportBackUrl: backUrl || traveller.passportBackUrl,
      documents,
    });
  }
  return next;
}
