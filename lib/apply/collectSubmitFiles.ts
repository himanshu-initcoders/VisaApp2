/**
 * Client helper: gather draft storage keys for submit (no file bytes).
 */

import type { ApplyTraveller } from '@/lib/apply/types';
import type { DraftScopeInput } from '@/lib/apply/draftScope';
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

/** Server draft object keys to promote on submit (keys only — never file bytes). */
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
 * After FormData draft sync, every local IDB slot must have a server key.
 * Returns a user-facing error string when any slot is still unsynced.
 */
export async function findUnsyncedIdbSlotsError(
  listingIdOrScope: string | DraftScopeInput,
  travellers: ApplyTraveller[],
  maybeScope?: Omit<DraftScopeInput, 'listingId'>
): Promise<string | null> {
  if (!isIdbAvailable()) return null;
  const scope = normalizeScope(listingIdOrScope, maybeScope);
  const keyed = new Set(
    collectDraftStorageKeysForSubmit(travellers).map(
      (r) => `${r.passengerId}:${r.slotKey}`
    )
  );

  const missing: string[] = [];

  async function check(passengerId: string, slotKey: string, label: string) {
    const dedupe = `${passengerId}:${slotKey}`;
    if (keyed.has(dedupe)) return;
    const record = await getFile(scope, passengerId, slotKey);
    if (record?.blob) missing.push(label);
  }

  for (const traveller of travellers) {
    const who = traveller.name?.trim() || 'Traveller';
    await check(traveller.id, PASSPORT_FRONT_SLOT, `${who}: passport front`);
    await check(traveller.id, PASSPORT_BACK_SLOT, `${who}: passport back`);
    for (const doc of traveller.documents ?? []) {
      if (!doc.key) continue;
      await check(
        traveller.id,
        doc.key,
        `${who}: ${doc.name || doc.key}`
      );
    }
  }

  if (missing.length === 0) return null;
  const preview = missing.slice(0, 3).join(', ');
  const more =
    missing.length > 3 ? ` (+${missing.length - 3} more)` : '';
  return `Could not upload all documents (${preview}${more}). Check your connection and try again.`;
}

/** Clear scoped local draft + IDB files after successful submit. */
export async function clearLocalDraftAfterSubmit(
  listingIdOrScope: string | DraftScopeInput,
  maybeScope?: Omit<DraftScopeInput, 'listingId'>
) {
  await clearApplyDraftAsync(listingIdOrScope, maybeScope);
}
