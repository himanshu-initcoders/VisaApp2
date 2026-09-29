/**
 * IndexedDB storage for apply-flow document binaries.
 * Draft JSON meta stays in localStorage; files live here until Phase 3 submit.
 */

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
  listingId: string,
  passengerId: string,
  slotKey: string
) {
  return `${listingId}:${passengerId}:${slotKey}`;
}

export function isIdbAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}

function openDb(): Promise<IDBDatabase> {
  if (!isIdbAvailable()) {
    return Promise.reject(new IdbUnavailableError());
  }

  return new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(IDB_NAME, IDB_VERSION);
    } catch {
      reject(new IdbUnavailableError());
      return;
    }

    request.onerror = () => {
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
    request.onsuccess = () => resolve(request.result);
  });
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

export async function putFile(
  listingId: string,
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
  const key = fileStorageKey(listingId, passengerId, slotKey);

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
  } finally {
    db.close();
  }
}

export async function getFile(
  listingId: string,
  passengerId: string,
  slotKey: string
): Promise<IdbFileRecord | null> {
  const db = await openDb();
  try {
    const key = fileStorageKey(listingId, passengerId, slotKey);
    const tx = db.transaction(IDB_STORE_FILES, 'readonly');
    const result = await idbRequest(
      tx.objectStore(IDB_STORE_FILES).get(key)
    );
    return (result as IdbFileRecord | undefined) ?? null;
  } catch (error) {
    throw mapIdbError(error);
  } finally {
    db.close();
  }
}

export async function deleteFile(
  listingId: string,
  passengerId: string,
  slotKey: string
): Promise<void> {
  const db = await openDb();
  try {
    const key = fileStorageKey(listingId, passengerId, slotKey);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_FILES, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(mapIdbError(tx.error));
      tx.objectStore(IDB_STORE_FILES).delete(key);
    });
  } catch (error) {
    throw mapIdbError(error);
  } finally {
    db.close();
  }
}

export async function deletePassengerFiles(
  listingId: string,
  passengerId: string
): Promise<void> {
  const prefix = `${listingId}:${passengerId}:`;
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
  } finally {
    db.close();
  }
}

export async function clearListingFiles(listingId: string): Promise<void> {
  const prefix = `${listingId}:`;
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
  } finally {
    db.close();
  }
}

export async function putDraftMeta(
  listingId: string,
  draft: IdbDraftMeta
): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_DRAFTS, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(mapIdbError(tx.error));
      tx.onabort = () => reject(mapIdbError(tx.error));
      tx.objectStore(IDB_STORE_DRAFTS).put(draft, listingId);
    });
  } catch (error) {
    throw mapIdbError(error);
  } finally {
    db.close();
  }
}

export async function getDraftMeta(
  listingId: string
): Promise<IdbDraftMeta | null> {
  const db = await openDb();
  try {
    const tx = db.transaction(IDB_STORE_DRAFTS, 'readonly');
    const result = await idbRequest(
      tx.objectStore(IDB_STORE_DRAFTS).get(listingId)
    );
    return (result as IdbDraftMeta | undefined) ?? null;
  } catch (error) {
    throw mapIdbError(error);
  } finally {
    db.close();
  }
}

export async function deleteDraftMeta(listingId: string): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_DRAFTS, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(mapIdbError(tx.error));
      tx.objectStore(IDB_STORE_DRAFTS).delete(listingId);
    });
  } catch (error) {
    throw mapIdbError(error);
  } finally {
    db.close();
  }
}

export function createPreviewUrlFromIdb(
  listingId: string,
  passengerId: string,
  slotKey: string
): Promise<string | undefined> {
  return getFile(listingId, passengerId, slotKey).then((record) => {
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
