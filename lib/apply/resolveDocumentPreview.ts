/**
 * Resolve a usable preview URL for draft/review document cards.
 * Prefers IndexedDB blob → multipart draft GET → verified preview/storage URL.
 * Always sniffs magic bytes so PDFs mis-keyed as `.jpg` still preview correctly.
 */

import type { DraftScopeInput } from '@/lib/apply/draftScope';
import {
  getFile,
  isIdbAvailable,
} from '@/lib/apply/idbDraftStorage';
import { sniffFileKind } from '@/lib/apply/sniffFileType';

function looksLikeUsableUrl(url?: string): boolean {
  if (!url) return false;
  if (url.startsWith('blob:')) return true;
  if (url.startsWith('data:')) return true;
  if (url.startsWith('/')) return true;
  if (url.startsWith('http://') || url.startsWith('https://')) return true;
  return false;
}

async function bufferToPreview(
  buffer: ArrayBuffer,
  mimeHint?: string,
  filename?: string
): Promise<{ url: string; mimeType: string }> {
  const sniffed = sniffFileKind(buffer, mimeHint, filename);
  const blob = new Blob([buffer], { type: sniffed.mimeType });
  return { url: URL.createObjectURL(blob), mimeType: sniffed.mimeType };
}

async function fetchAsObjectUrl(
  url: string,
  mimeHint?: string,
  filename?: string
): Promise<{ url: string; mimeType: string } | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    const headerMime =
      response.headers.get('content-type')?.split(';')[0]?.trim() || mimeHint;
    return bufferToPreview(buffer, headerMime, filename);
  } catch {
    return null;
  }
}

export async function resolveDocumentPreviewUrl(input: {
  listingId?: string;
  travellerId?: string;
  slotKey?: string;
  storageKey?: string;
  ownerUserId?: string;
  sessionUserId?: string | null;
  previewUrl?: string;
  storageUrl?: string;
  filename?: string;
}): Promise<{ url: string; mimeType?: string } | null> {
  const {
    listingId,
    travellerId,
    slotKey,
    storageKey,
    ownerUserId,
    sessionUserId,
    previewUrl,
    storageUrl,
    filename,
  } = input;

  // 1) Fresh blob from IndexedDB
  if (listingId && travellerId && slotKey && isIdbAvailable()) {
    try {
      const scope: DraftScopeInput = {
        listingId,
        sessionUserId: sessionUserId ?? null,
        onBehalfOfUserId: ownerUserId ?? null,
      };
      const record = await getFile(scope, travellerId, slotKey);
      if (record?.blob) {
        const buffer = await record.blob.arrayBuffer();
        return bufferToPreview(
          buffer,
          record.mimeType,
          record.filename || filename
        );
      }
    } catch {
      // fall through
    }
  }

  // 2) Download draft file from multipart API
  if (storageKey) {
    try {
      const params = new URLSearchParams({ storageKey });
      if (ownerUserId) params.set('ownerUserId', ownerUserId);
      const response = await fetch(
        `/api/apply/draft-files?${params.toString()}`
      );
      if (response.ok) {
        const buffer = await response.arrayBuffer();
        const headerMime =
          response.headers.get('content-type')?.split(';')[0]?.trim() ||
          undefined;
        const keyName = storageKey.split('/').pop() || filename;
        return bufferToPreview(buffer, headerMime, keyName);
      }
    } catch {
      // fall through
    }
  }

  // 3) Existing URLs — verify + sniff
  const candidates = [storageUrl, previewUrl].filter(
    (url): url is string => Boolean(url && looksLikeUsableUrl(url))
  );
  candidates.sort((a, b) => {
    const rank = (url: string) => {
      if (url.startsWith('/api/apply/draft-files')) return 0;
      if (url.startsWith('/api/media')) return 1;
      if (url.startsWith('blob:')) return 3;
      return 2;
    };
    return rank(a) - rank(b);
  });

  for (const url of candidates) {
    const materialized = await fetchAsObjectUrl(url, undefined, filename);
    if (materialized) return materialized;
  }

  return null;
}
