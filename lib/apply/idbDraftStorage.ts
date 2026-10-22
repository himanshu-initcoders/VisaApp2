/**
 * IndexedDB storage for apply-flow document binaries + draft meta.
 * Keys are scoped as `{scopeUserId}:{listingId}` (and file keys under that).
 */

import {
  draftStorageCompositeKey,
  resolveDraftScopeUserId,
  type DraftScopeInput,
} from '@/lib/apply/draftScope';

export const IDB_NAME = 'visa-apply-idb-v1';
export const IDB_VERSION = 1;
export const IDB_STORE_DRAFTS = 'drafts';
export const IDB_STORE_FILES = 'files';

export const PASSPORT_FRONT_SLOT = 'passport-front';
export const PASSPORT_BACK_SLOT = 'passport-back';

export class IdbQuotaError extends Error {
  readonly code = 'IDB_QUOTA' as const;
  constructor(message = 'Browser storage is full. Remove a large file and try again.') {
    super(message);
    this.name = 'IdbQuotaError';
  }
}

export class IdbUnavailableError extends Error {
  readonly code = 'IDB_UNAVAILABLE' as const;
  constructor(
    message = 'Browser storage is unavailable. Use a normal (non-private) window to continue with documents.'
  ) {
    super(message);
    this.name = 'IdbUnavailableError';
  }
}

export interface IdbFileRecord {
  blob: Blob;
  mimeType: string;
  filename: string;
  updatedAt: string;
  size: number;
}

/** JSON draft meta stored in IndexedDB (no file binaries). */
export type IdbDraftMeta = Record<string, unknown>;

export function fileStorageKey(
  scopeKey: string,
  passengerId: string,
  slotKey: string
) {
  return `${scopeKey}:${passengerId}:${slotKey}`;
}

export function isIdbAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}

let sharedDb: IDBDatabase | null = null;
let openPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!isIdbAvailable()) {
    return Promise.reject(new IdbUnavailableError());
  }
  if (sharedDb) return Promise.resolve(sharedDb);
  if (openPromise) return openPromise;

  openPromise = new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(IDB_NAME, IDB_VERSION);
    } catch {
      openPromise = null;
      reject(new IdbUnavailableError());
      return;
    }

    request.onerror = () => {
      openPromise = null;
      reject(new IdbUnavailableError(request.error?.message));
    };
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE_DRAFTS)) {
        db.createObjectStore(IDB_STORE_DRAFTS);
      }
      if (!db.objectStoreNames.contains(IDB_STORE_FILES)) {
        db.createObjectStore(IDB_STORE_FILES);
      }
    };
    request.onsuccess = () => {
      sharedDb = request.result;
      sharedDb.onclose = () => {
        sharedDb = null;
        openPromise = null;
      };
      sharedDb.onversionchange = () => {
        sharedDb?.close();
        sharedDb = null;
        openPromise = null;
      };
      resolve(sharedDb);
    };
  });

  return openPromise;
}

function mapIdbError(error: unknown): Error {
  if (error instanceof IdbQuotaError || error instanceof IdbUnavailableError) {
    return error;
  }
  const name =
    error && typeof error === 'object' && 'name' in error
      ? String((error as { name: string }).name)
      : '';
  if (name === 'QuotaExceededError') {
    return new IdbQuotaError();
  }
  if (name === 'InvalidStateError' || name === 'UnknownError') {
    return new IdbUnavailableError();
  }
  return error instanceof Error ? error : new Error(String(error));
}

function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(mapIdbError(request.error));
  });
}

function resolveScopeKey(input: DraftScopeInput | string): string {
  if (typeof input === 'string') {
    // Legacy callers passed listingId only — treat as anon scope
    return draftStorageCompositeKey('anon', input);
  }
  return draftStorageCompositeKey(
    resolveDraftScopeUserId(input),
    input.listingId
  );
}

export async function putFile(
  scope: DraftScopeInput | string,
  passengerId: string,
  slotKey: string,
  input: {
    blob: Blob;
    mimeType: string;
    filename: string;
  }
): Promise<IdbFileRecord> {
  const db = await openDb();
  const record: IdbFileRecord = {
    blob: input.blob,
    mimeType: input.mimeType || input.blob.type || 'application/octet-stream',
    filename: input.filename,
    updatedAt: new Date().toISOString(),
    size: input.blob.size,
  };
  const key = fileStorageKey(resolveScopeKey(scope), passengerId, slotKey);

  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_FILES, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(mapIdbError(tx.error));
      tx.onabort = () => reject(mapIdbError(tx.error));
      tx.objectStore(IDB_STORE_FILES).put(record, key);
    });
    return record;
  } catch (error) {
    throw mapIdbError(error);
  }
}

export async function getFile(
  scope: DraftScopeInput | string,
  passengerId: string,
  slotKey: string
): Promise<IdbFileRecord | null> {
  const db = await openDb();
  try {
    const key = fileStorageKey(resolveScopeKey(scope), passengerId, slotKey);
    const tx = db.transaction(IDB_STORE_FILES, 'readonly');
    const result = await idbRequest(
      tx.objectStore(IDB_STORE_FILES).get(key)
    );
    return (result as IdbFileRecord | undefined) ?? null;
  } catch (error) {
    throw mapIdbError(error);
  }
}

export async function deleteFile(
  scope: DraftScopeInput | string,
  passengerId: string,
  slotKey: string
): Promise<void> {
  const db = await openDb();
  try {
    const key = fileStorageKey(resolveScopeKey(scope), passengerId, slotKey);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_FILES, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(mapIdbError(tx.error));
      tx.objectStore(IDB_STORE_FILES).delete(key);
    });
  } catch (error) {
    throw mapIdbError(error);
  }
}

export async function deletePassengerFiles(
  scope: DraftScopeInput | string,
  passengerId: string
): Promise<void> {
  const prefix = `${resolveScopeKey(scope)}:${passengerId}:`;
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_FILES, 'readwrite');
      const store = tx.objectStore(IDB_STORE_FILES);
      const request = store.openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        if (String(cursor.key).startsWith(prefix)) {
          cursor.delete();
        }
        cursor.continue();
      };
      request.onerror = () => reject(mapIdbError(request.error));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(mapIdbError(tx.error));
    });
  } catch (error) {
    throw mapIdbError(error);
  }
}

export async function clearListingFiles(
  scope: DraftScopeInput | string
): Promise<void> {
  const prefix = `${resolveScopeKey(scope)}:`;
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_FILES, 'readwrite');
      const store = tx.objectStore(IDB_STORE_FILES);
      const request = store.openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        if (String(cursor.key).startsWith(prefix)) {
          cursor.delete();
        }
        cursor.continue();
      };
      request.onerror = () => reject(mapIdbError(request.error));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(mapIdbError(tx.error));
    });
  } catch (error) {
    throw mapIdbError(error);
  }
}

export async function putDraftMeta(
  scope: DraftScopeInput | string,
  draft: IdbDraftMeta
): Promise<void> {
  const db = await openDb();
  const key = resolveScopeKey(scope);
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_DRAFTS, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(mapIdbError(tx.error));
      tx.onabort = () => reject(mapIdbError(tx.error));
      tx.objectStore(IDB_STORE_DRAFTS).put(draft, key);
    });
  } catch (error) {
    throw mapIdbError(error);
  }
}

export async function getDraftMeta(
  scope: DraftScopeInput | string
): Promise<IdbDraftMeta | null> {
  const db = await openDb();
  try {
    const key = resolveScopeKey(scope);
    const tx = db.transaction(IDB_STORE_DRAFTS, 'readonly');
    const store = tx.objectStore(IDB_STORE_DRAFTS);
    let result = await idbRequest(store.get(key));
    // Pre-login Continue UX: also check legacy listing-only key
    if (!result && typeof scope === 'string') {
      result = await idbRequest(store.get(scope));
    } else if (
      !result &&
      typeof scope !== 'string' &&
      resolveDraftScopeUserId(scope) === 'anon' &&
      !scope.onBehalfOfUserId
    ) {
      result = await idbRequest(store.get(scope.listingId));
    }
    return (result as IdbDraftMeta | undefined) ?? null;
  } catch (error) {
    throw mapIdbError(error);
  }
}

export async function deleteDraftMeta(
  scope: DraftScopeInput | string
): Promise<void> {
  const db = await openDb();
  try {
    const key = resolveScopeKey(scope);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_DRAFTS, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(mapIdbError(tx.error));
      tx.objectStore(IDB_STORE_DRAFTS).delete(key);
    });
  } catch (error) {
    throw mapIdbError(error);
  }
}

/**
 * One-time migrate legacy listing-only IDB keys → scoped keys for current applicant.
 * Staff on-behalf never migrates anonymous keys.
 */
export async function migrateLegacyIdbKeys(input: DraftScopeInput): Promise<void> {
  const scopeUserId = resolveDraftScopeUserId(input);
  if (scopeUserId === 'anon' || input.onBehalfOfUserId) return;
  if (!input.listingId || !isIdbAvailable()) return;

  const legacyListingId = input.listingId;
  const scopedKey = draftStorageCompositeKey(scopeUserId, legacyListingId);
  const db = await openDb();

  try {
    // Meta
    const metaTx = db.transaction(IDB_STORE_DRAFTS, 'readwrite');
    const metaStore = metaTx.objectStore(IDB_STORE_DRAFTS);
    const legacyMeta = await idbRequest(metaStore.get(legacyListingId));
    const scopedMeta = await idbRequest(metaStore.get(scopedKey));
    if (legacyMeta && !scopedMeta) {
      metaStore.put(legacyMeta, scopedKey);
      metaStore.delete(legacyListingId);
    }
    await new Promise<void>((resolve, reject) => {
      metaTx.oncomplete = () => resolve();
      metaTx.onerror = () => reject(mapIdbError(metaTx.error));
    });

    // Files: `{listingId}:{passenger}:{slot}` → `{scope}:{listingId}:{passenger}:{slot}`
    const filesTx = db.transaction(IDB_STORE_FILES, 'readwrite');
    const filesStore = filesTx.objectStore(IDB_STORE_FILES);
    const legacyPrefix = `${legacyListingId}:`;
    await new Promise<void>((resolve, reject) => {
      const request = filesStore.openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        const key = String(cursor.key);
        if (key.startsWith(legacyPrefix) && !key.startsWith(`${scopedKey}:`)) {
          const rest = key.slice(legacyPrefix.length);
          const nextKey = `${scopedKey}:${rest}`;
          const existingReq = filesStore.get(nextKey);
          existingReq.onsuccess = () => {
            if (!existingReq.result) {
              filesStore.put(cursor.value, nextKey);
            }
            filesStore.delete(key);
          };
        }
        cursor.continue();
      };
      request.onerror = () => reject(mapIdbError(request.error));
      filesTx.oncomplete = () => resolve();
      filesTx.onerror = () => reject(mapIdbError(filesTx.error));
    });
  } catch (error) {
    console.warn('IDB draft key migration failed', error);
  }
}

export function createPreviewUrlFromIdb(
  scope: DraftScopeInput | string,
  passengerId: string,
  slotKey: string
): Promise<string | undefined> {
  return getFile(scope, passengerId, slotKey).then((record) => {
    if (!record) return undefined;
    return URL.createObjectURL(record.blob);
  });
}

export function dataUrlToBlob(dataUrl: string): Blob | null {
  try {
    const [header, data] = dataUrl.split(',');
    if (!header || data === undefined) return null;
    const mimeMatch = header.match(/data:([^;]+)/);
    const mimeType = mimeMatch?.[1] || 'application/octet-stream';
    const isBase64 = /;base64/i.test(header);
    if (isBase64) {
      const binary = atob(data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new Blob([bytes], { type: mimeType });
    }
    return new Blob([decodeURIComponent(data)], { type: mimeType });
  } catch {
    return null;
  }
}

export async function urlToBlob(url: string): Promise<Blob | null> {
  if (!url) return null;
  if (url.startsWith('data:')) return dataUrlToBlob(url);
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.blob();
  } catch {
    return null;
  }
}

export { extensionFromMime } from '@/lib/upload/applicationKey';

export function idbErrorMessage(error: unknown): string {
  if (error instanceof IdbQuotaError || error instanceof IdbUnavailableError) {
    return error.message;
  }
  if (error instanceof Error && error.message) return error.message;
  return 'Could not save the file in browser storage.';
}
