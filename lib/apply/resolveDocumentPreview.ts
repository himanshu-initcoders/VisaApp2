/**
 * Resolve a usable preview URL for draft/review document cards.
 * Prefers IndexedDB blob → multipart draft GET → existing preview/storage URL.
 */

import type { DraftScopeInput } from '@/lib/apply/draftScope';
import {
  getFile,
  isIdbAvailable,
} from '@/lib/apply/idbDraftStorage';

function looksLikeUsableUrl(url?: string): boolean {
  if (!url) return false;
  if (url.startsWith('blob:')) return true;
  if (url.startsWith('data:')) return true;
  if (url.startsWith('/')) return true;
  if (url.startsWith('http://') || url.startsWith('https://')) return true;
  return false;
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
  } = input;

  // 1) Fresh blob from IndexedDB (most reliable after draft restore)
  if (listingId && travellerId && slotKey && isIdbAvailable()) {
    try {
      const scope: DraftScopeInput = {
        listingId,
        sessionUserId: sessionUserId ?? null,
        onBehalfOfUserId: ownerUserId ?? null,
      };
      const record = await getFile(scope, travellerId, slotKey);
      if (record?.blob) {
        return {
          url: URL.createObjectURL(record.blob),
          mimeType: record.mimeType,
        };
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
      const response = await fetch(`/api/apply/draft-files?${params.toString()}`);
      if (response.ok) {
        const blob = await response.blob();
        const mimeType =
          response.headers.get('content-type') || 'application/octet-stream';
        return { url: URL.createObjectURL(blob), mimeType };
      }
    } catch {
      // fall through
    }
  }

  // 3) Existing URLs (prefer non-blob first if blob may be revoked)
  if (looksLikeUsableUrl(storageUrl) && !storageUrl!.startsWith('blob:')) {
    return { url: storageUrl! };
  }
  if (looksLikeUsableUrl(previewUrl)) {
    return { url: previewUrl! };
  }
  if (looksLikeUsableUrl(storageUrl)) {
    return { url: storageUrl! };
  }

  return null;
}
