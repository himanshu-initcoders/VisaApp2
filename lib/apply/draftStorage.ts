import type { ApplyStep, ApplyTraveller } from '@/lib/apply/types';
import type { TravellerDocumentUpload } from '@/lib/apply/applicationForm';
import {
  resolveDraftScopeUserId,
  type DraftScopeInput,
} from '@/lib/apply/draftScope';
import {
  PASSPORT_BACK_SLOT,
  PASSPORT_FRONT_SLOT,
  clearListingFiles,
  createPreviewUrlFromIdb,
  deleteDraftMeta,
  getDraftMeta,
  isIdbAvailable,
  migrateLegacyIdbKeys,
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
  /** Applicant optional insurance interest at checkout. */
  interestedInInsurance?: boolean;
}

export type DraftStorageScope = DraftScopeInput;

function localStorageKey(scope: DraftScopeInput): string {
  const scopeUserId = resolveDraftScopeUserId(scope);
  return `${APPLY_DRAFT_PREFIX}${scopeUserId}:${scope.listingId}`;
}

function legacyLocalStorageKey(listingId: string): string {
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

/** How much filled content a draft has — used during migrate / merge only. */
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
    draftFileRefs: traveller.draftFileRefs?.map((ref) => ({
      slotKey: ref.slotKey,
      storageKey: ref.storageKey,
      url: ref.url,
      mimeType: ref.mimeType,
      filename: ref.filename,
      size: ref.size,
    })),
    documents: traveller.documents?.map((doc) => ({
      key: doc.key,
      name: doc.name,
      mimeType: doc.mimeType,
      size: doc.size,
      storedInIdb: doc.storedInIdb ?? Boolean(doc.name),
      storageKey: doc.storageKey,
      storageUrl: doc.storageUrl,
    })),
  }));
}

function migrateLegacyLocalStorage(scope: DraftScopeInput): void {
  if (!canUseStorage() || !scope.listingId) return;
  const scopeUserId = resolveDraftScopeUserId(scope);
  // Staff on-behalf never reads anonymous listing-only keys
  if (scopeUserId === 'anon' || scope.onBehalfOfUserId) return;

  const scoped = localStorageKey(scope);
  if (localStorage.getItem(scoped)) return;

  const legacy = legacyLocalStorageKey(scope.listingId);
  const raw = localStorage.getItem(legacy);
  if (!raw) return;
  try {
    localStorage.setItem(scoped, raw);
    localStorage.removeItem(legacy);
  } catch {
    // ignore
  }
}

function readLocalStorageDraft(scope: DraftScopeInput): ApplyDraft | null {
  if (!canUseStorage() || !scope.listingId) return null;
  migrateLegacyLocalStorage(scope);
  try {
    let raw = localStorage.getItem(localStorageKey(scope));
    // Pre-login / anon: still detect legacy listing-only keys for Continue UX
    if (!raw && resolveDraftScopeUserId(scope) === 'anon' && !scope.onBehalfOfUserId) {
      raw = localStorage.getItem(legacyLocalStorageKey(scope.listingId));
    }
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ApplyDraft;
    return isValidDraft(parsed, scope.listingId) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * @deprecated Prefer {@link readApplyDraftAsync}. Sync localStorage-only read.
 */
export function readApplyDraft(
  listingIdOrScope: string | DraftScopeInput,
  maybeScope?: Omit<DraftScopeInput, 'listingId'>
): ApplyDraft | null {
  return readLocalStorageDraft(normalizeScope(listingIdOrScope, maybeScope));
}

/**
 * Prefer IndexedDB draft meta, fall back to localStorage cache.
 */
export async function readApplyDraftAsync(
  listingIdOrScope: string | DraftScopeInput,
  maybeScope?: Omit<DraftScopeInput, 'listingId'>
): Promise<ApplyDraft | null> {
  const scope = normalizeScope(listingIdOrScope, maybeScope);
  migrateLegacyLocalStorage(scope);
  if (isIdbAvailable()) {
    try {
      await migrateLegacyIdbKeys(scope);
    } catch {
      // ignore
    }
  }

  const local = readLocalStorageDraft(scope);
  let idbDraft: ApplyDraft | null = null;

  if (isIdbAvailable()) {
    try {
      const meta = await getDraftMeta(scope);
      if (meta && isValidDraft(meta, scope.listingId)) {
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

export function hasApplyDraft(
  listingIdOrScope: string | DraftScopeInput,
  maybeScope?: Omit<DraftScopeInput, 'listingId'>
): boolean {
  return Boolean(readApplyDraft(listingIdOrScope, maybeScope));
}

export function writeApplyDraft(
  draft: ApplyDraft,
  scopeExtras?: Omit<DraftScopeInput, 'listingId'>
): void {
  void writeApplyDraftAsync(draft, scopeExtras);
}

/** Awaitable draft write (IndexedDB source of truth + localStorage cache). */
export async function writeApplyDraftAsync(
  draft: ApplyDraft,
  scopeExtras?: Omit<DraftScopeInput, 'listingId'>
): Promise<void> {
  if (!draft.listingId) return;

  const scope: DraftScopeInput = {
    listingId: draft.listingId,
    sessionUserId: scopeExtras?.sessionUserId ?? null,
    onBehalfOfUserId: scopeExtras?.onBehalfOfUserId ?? null,
  };

  const payload: ApplyDraft = {
    ...draft,
    version: APPLY_DRAFT_VERSION,
    updatedAt: new Date().toISOString(),
    travellers: serializeTravellersForDraft(draft.travellers),
    travellersCount: Math.max(1, draft.travellers.length),
  };

  if (canUseStorage()) {
    try {
      localStorage.setItem(localStorageKey(scope), JSON.stringify(payload));
    } catch (error) {
      console.warn('Could not save application draft to localStorage', error);
    }
  }

  if (isIdbAvailable()) {
    try {
      await putDraftMeta(
        scope,
        payload as unknown as Record<string, unknown>
      );
    } catch (error) {
      console.warn('Could not save application draft to IndexedDB', error);
    }
  }
}

export function clearApplyDraft(
  listingIdOrScope: string | DraftScopeInput,
  maybeScope?: Omit<DraftScopeInput, 'listingId'>
): void {
  void clearApplyDraftAsync(listingIdOrScope, maybeScope);
}

/** Clear scoped localStorage, IDB meta, and IDB files. */
export async function clearApplyDraftAsync(
  listingIdOrScope: string | DraftScopeInput,
  maybeScope?: Omit<DraftScopeInput, 'listingId'>
): Promise<void> {
  const scope = normalizeScope(listingIdOrScope, maybeScope);
  if (!scope.listingId) return;

  if (canUseStorage()) {
    try {
      localStorage.removeItem(localStorageKey(scope));
      // Also clear legacy listing-only key when this is the applicant session
      if (!scope.onBehalfOfUserId) {
        localStorage.removeItem(legacyLocalStorageKey(scope.listingId));
      }
    } catch {
      // ignore
    }
  }
  if (isIdbAvailable()) {
    try {
      await deleteDraftMeta(scope);
      await clearListingFiles(scope);
    } catch {
      // ignore
    }
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
  scope: DraftScopeInput;
  passengerId: string;
  slotKey: string;
  url?: string;
  filename: string;
  mimeType?: string;
}): Promise<boolean> {
  if (!input.url || !isBinaryUrl(input.url)) return false;
  const blob = await urlToBlob(input.url);
  if (!blob) return false;
  await putFile(input.scope, input.passengerId, input.slotKey, {
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
  draft: ApplyDraft,
  scopeExtras?: Omit<DraftScopeInput, 'listingId'>
): Promise<ApplyTraveller[]> {
  const scope: DraftScopeInput = {
    listingId: draft.listingId,
    sessionUserId: scopeExtras?.sessionUserId ?? null,
    onBehalfOfUserId: scopeExtras?.onBehalfOfUserId ?? null,
  };

  if (!isIdbAvailable()) {
    return draft.travellers.map((t) => ({ ...t, editing: false }));
  }

  let migrated = false;
  const travellers: ApplyTraveller[] = [];

  for (const traveller of draft.travellers) {
    const nextDocs: TravellerDocumentUpload[] = [];

    if (
      await migrateUrlToIdb({
        scope,
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
        scope,
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
          scope,
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
    await writeApplyDraftAsync({ ...draft, travellers }, scopeExtras);
  }

  return travellers;
}

/** Rehydrate ephemeral object URLs from IndexedDB for a listing draft. */
export async function rehydrateTravellerPreviews(
  listingIdOrScope: string | DraftScopeInput,
  travellers: ApplyTraveller[],
  maybeScope?: Omit<DraftScopeInput, 'listingId'>
): Promise<ApplyTraveller[]> {
  const scope = normalizeScope(listingIdOrScope, maybeScope);
  if (!isIdbAvailable()) return travellers;

  const next: ApplyTraveller[] = [];
  for (const traveller of travellers) {
    const frontUrl = await createPreviewUrlFromIdb(
      scope,
      traveller.id,
      PASSPORT_FRONT_SLOT
    );
    const backUrl = await createPreviewUrlFromIdb(
      scope,
      traveller.id,
      PASSPORT_BACK_SLOT
    );

    const documents: TravellerDocumentUpload[] = [];
    for (const doc of traveller.documents ?? []) {
      const previewUrl = await createPreviewUrlFromIdb(
        scope,
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
