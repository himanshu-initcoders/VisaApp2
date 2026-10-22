/**
 * Last-write-wins merge between local IndexedDB/localStorage draft and server.
 */

'use client';

import {
  readApplyDraftAsync,
  writeApplyDraftAsync,
  type ApplyDraft,
} from '@/lib/apply/draftStorage';
import type { DraftScopeInput } from '@/lib/apply/draftScope';
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
    interestedInInsurance: draft.interestedInInsurance,
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
    interestedInInsurance: payload.interestedInInsurance,
  };
}

/**
 * Sync local apply draft with server for the signed-in user.
 * Prefer the wizard hydrate pipeline; kept for optional post-login helpers.
 */
export async function syncDraftAfterLogin(
  listingIdOrScope: string | DraftScopeInput,
  countryCode?: string,
  maybeScope?: Omit<DraftScopeInput, 'listingId'>
): Promise<DraftSyncResult> {
  try {
    const scope: DraftScopeInput =
      typeof listingIdOrScope === 'string'
        ? {
            listingId: listingIdOrScope,
            sessionUserId: maybeScope?.sessionUserId ?? null,
            onBehalfOfUserId: maybeScope?.onBehalfOfUserId ?? null,
          }
        : listingIdOrScope;

    const local = await readApplyDraftAsync(scope);
    const remote = await getApplicationDraft(scope.listingId);
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
        listingId: scope.listingId,
        countryCode: countryCode ?? local.countryCode,
        payload: toServerPayload(local),
      });
      if (!result.success) {
        return { status: 'error', message: result.error };
      }
      return { status: 'pushed' };
    }

    if (server && (!local || serverTs > localTs)) {
      await writeApplyDraftAsync(fromServerPayload(server.payload), {
        sessionUserId: scope.sessionUserId,
        onBehalfOfUserId: scope.onBehalfOfUserId,
      });
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
