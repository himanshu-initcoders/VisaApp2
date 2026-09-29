/**
 * Last-write-wins merge between local IndexedDB/localStorage draft and server.
 */

'use client';

import {
  readApplyDraftAsync,
  writeApplyDraftAsync,
  type ApplyDraft,
} from '@/lib/apply/draftStorage';
import {
  getApplicationDraft,
  upsertApplicationDraft,
  type ServerDraftPayload,
} from '@/lib/apply/serverDraft';

export type DraftSyncResult =
  | { status: 'pushed' }
  | { status: 'pulled'; message: string }
  | { status: 'noop' }
  | { status: 'error'; message: string };

function toServerPayload(draft: ApplyDraft): ServerDraftPayload {
  return {
    version: draft.version,
    updatedAt: draft.updatedAt,
    countryCode: draft.countryCode,
    countryName: draft.countryName,
    listingId: draft.listingId,
    processName: draft.processName,
    step: draft.step,
    primaryName: draft.primaryName,
    travellers: draft.travellers,
    departure: draft.departure,
    travellersCount: draft.travellersCount,
  };
}

function fromServerPayload(payload: ServerDraftPayload): ApplyDraft {
  return {
    version: 1,
    updatedAt: payload.updatedAt,
    countryCode: payload.countryCode,
    countryName: payload.countryName,
    listingId: payload.listingId,
    processName: payload.processName,
    step: payload.step as ApplyDraft['step'],
    primaryName: payload.primaryName,
    travellers: payload.travellers as ApplyDraft['travellers'],
    departure: payload.departure as ApplyDraft['departure'],
    travellersCount: payload.travellersCount,
  };
}

/**
 * Sync local apply draft with server for the signed-in user.
 * Files stay in IndexedDB; only JSON meta is exchanged.
 */
export async function syncDraftAfterLogin(
  listingId: string,
  countryCode?: string
): Promise<DraftSyncResult> {
  try {
    const local = await readApplyDraftAsync(listingId);
    const remote = await getApplicationDraft(listingId);
    if (!remote.success) {
      return { status: 'error', message: remote.error };
    }

    const server = remote.draft;
    const localTs = local ? Date.parse(local.updatedAt) || 0 : 0;
    const serverTs = server ? Date.parse(server.updatedAt) || 0 : 0;

    if (!local && !server) {
      return { status: 'noop' };
    }

    if (local && (!server || localTs >= serverTs)) {
      const result = await upsertApplicationDraft({
        listingId,
        countryCode: countryCode ?? local.countryCode,
        payload: toServerPayload(local),
      });
      if (!result.success) {
        return { status: 'error', message: result.error };
      }
      return { status: 'pushed' };
    }

    if (server && (!local || serverTs > localTs)) {
      await writeApplyDraftAsync(fromServerPayload(server.payload));
      return {
        status: 'pulled',
        message: 'Restored draft from your account',
      };
    }

    return { status: 'noop' };
  } catch (error) {
    return {
      status: 'error',
      message:
        error instanceof Error ? error.message : 'Could not sync application draft',
    };
  }
}
