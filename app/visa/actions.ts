'use server';

import { and, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  documents,
  passportServices,
  visaApplications,
} from '@/lib/db/schema';
import type { ApplyFormConfig } from '@/lib/apply/applicationForm';
import {
  getApplyPreviousProfiles,
  getPassengerAutofillForListing,
  type ApplyPreviousProfile,
  type PassengerAutofillPayload,
} from '@/lib/apply/previousProfilesAutofill';
import { stageAutofillDocumentsToDraft } from '@/lib/apply/stageAutofillDocuments';
import {
  getApplicationDraft,
  getApplicationDraftForUser,
  upsertApplicationDraft,
  upsertApplicationDraftForUser,
} from '@/lib/apply/serverDraft';
import { readStoredObject } from '@/lib/upload/readStoredObject';
import type { ActionResponse } from '@/types/admin';

export type { ApplyPreviousProfile, PassengerAutofillPayload };

async function assertDocumentOwnedByUser(
  userId: string,
  doc: { applicationId: string; s3Key: string }
): Promise<boolean> {
  const [visaOwner] = await db
    .select({ id: visaApplications.id })
    .from(visaApplications)
    .where(
      and(
        eq(visaApplications.id, doc.applicationId),
        eq(visaApplications.userId, userId)
      )
    )
    .limit(1);

  if (visaOwner) return true;

  const [passportOwner] = await db
    .select({ id: passportServices.id })
    .from(passportServices)
    .where(
      and(
        eq(passportServices.id, doc.applicationId),
        eq(passportServices.userId, userId)
      )
    )
    .limit(1);

  return Boolean(passportOwner);
}

/**
 * List previous passenger profiles for the signed-in apply user (DB only).
 * Works for applicants and staff testing apply with their own applications.
 */
export async function listMyApplyPreviousProfiles(input?: {
  ownerUserId?: string | null;
}): Promise<ActionResponse<ApplyPreviousProfile[]>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, message: 'Unauthorized' };
    }

    const isStaff =
      session.user.role === 'admin' || session.user.role === 'reviewer';
    const requestedOwner = input?.ownerUserId?.trim() || null;
    let userId = session.user.id;

    if (requestedOwner && requestedOwner !== session.user.id) {
      if (!isStaff) {
        return { success: false, message: 'Unauthorized' };
      }
      userId = requestedOwner;
    }

    const profiles = await getApplyPreviousProfiles(userId);
    return { success: true, message: 'OK', data: profiles };
  } catch (error) {
    return {
      success: false,
      message: 'Failed to load previous profiles',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Autofill answers from past applications (Postgres), then stage matching
 * documents into this listing's draft storage. No IndexedDB / base64 round-trip.
 */
export async function getMyPassengerAutofill(input: {
  profileId: string;
  formConfig: ApplyFormConfig;
  listingId: string;
  countryCode: string;
  travellerId: string;
  ownerUserId?: string | null;
}): Promise<ActionResponse<PassengerAutofillPayload>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, message: 'Unauthorized' };
    }

    const isStaff =
      session.user.role === 'admin' || session.user.role === 'reviewer';
    const requestedOwner = input.ownerUserId?.trim() || null;
    let userId = session.user.id;

    if (requestedOwner && requestedOwner !== session.user.id) {
      if (!isStaff) {
        return { success: false, message: 'Unauthorized' };
      }
      userId = requestedOwner;
    }

    const profileId = String(input.profileId || '').trim();
    const listingId = String(input.listingId || '').trim();
    const countryCode = String(input.countryCode || '').trim();
    const travellerId = String(input.travellerId || '').trim();
    if (!profileId || !input.formConfig || !listingId || !countryCode || !travellerId) {
      return { success: false, message: 'Missing profile or draft target' };
    }

    const payload = await getPassengerAutofillForListing({
      userId,
      profileId,
      formConfig: input.formConfig,
    });

    if (!payload) {
      return { success: false, message: 'Profile not found' };
    }

    const existingDraft =
      requestedOwner && requestedOwner !== session.user.id
        ? await getApplicationDraftForUser(listingId, userId)
        : await getApplicationDraft(listingId);

    let applicationId =
      existingDraft.success && existingDraft.draft
        ? existingDraft.draft.applicationId
        : null;

    if (!applicationId) {
      const draftPayload = {
        version: 1,
        updatedAt: new Date().toISOString(),
        countryCode: countryCode.toUpperCase().slice(0, 2),
        countryName: '',
        listingId,
        processName: '',
        step: 'travellers',
        primaryName: '',
        travellers: [{ id: travellerId, name: '' }],
        departure: {},
        travellersCount: 1,
      };

      const saved =
        requestedOwner && requestedOwner !== session.user.id
          ? await upsertApplicationDraftForUser({
              listingId,
              targetUserId: userId,
              countryCode,
              payload: draftPayload,
            })
          : await upsertApplicationDraft({
              listingId,
              countryCode,
              payload: draftPayload,
            });

      if (!saved.success) {
        return { success: false, message: saved.error };
      }
      applicationId = saved.applicationId;
    }

    const staged = await stageAutofillDocumentsToDraft({
      userId,
      countryCode,
      listingId,
      applicationId,
      travellerId,
      payload,
    });

    return { success: true, message: 'OK', data: staged };
  } catch (error) {
    return {
      success: false,
      message: 'Failed to load autofill data',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Fetch a document binary the signed-in user owns (for restore into apply IDB).
 */
export async function fetchMyDocumentBlob(input: {
  documentDbId?: string | null;
  storageKey?: string | null;
}): Promise<
  ActionResponse<{ base64: string; mimeType: string; filename: string }>
> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, message: 'Unauthorized' };
    }

    const documentDbId = input.documentDbId?.trim() || null;
    const storageKey = input.storageKey?.trim() || null;

    if (!documentDbId && !storageKey) {
      return { success: false, message: 'Document reference required' };
    }

    let s3Key = storageKey;
    let mimeType = 'application/octet-stream';
    let filename = 'document.bin';
    let applicationId: string | null = null;

    if (documentDbId) {
      const [doc] = await db
        .select()
        .from(documents)
        .where(eq(documents.id, documentDbId))
        .limit(1);

      if (!doc) {
        return { success: false, message: 'Document not found' };
      }

      const owned = await assertDocumentOwnedByUser(session.user.id, doc);
      if (!owned) {
        return { success: false, message: 'Unauthorized' };
      }

      s3Key = doc.s3Key;
      mimeType = doc.mimeType || mimeType;
      filename = doc.filename || filename;
      applicationId = doc.applicationId;
    } else if (s3Key) {
      // Resolve ownership via matching documents row or visa app path userId segment
      const [doc] = await db
        .select()
        .from(documents)
        .where(eq(documents.s3Key, s3Key))
        .limit(1);

      if (doc) {
        const owned = await assertDocumentOwnedByUser(session.user.id, doc);
        if (!owned) {
          return { success: false, message: 'Unauthorized' };
        }
        mimeType = doc.mimeType || mimeType;
        filename = doc.filename || filename;
        applicationId = doc.applicationId;
      } else {
        // Path must include this user id: applications/.../{userId}/...
        const userSegment = `/${session.user.id}/`;
        if (!s3Key.includes(userSegment)) {
          return { success: false, message: 'Unauthorized' };
        }
        filename = s3Key.split('/').pop() || filename;
      }
    }

    if (!s3Key) {
      return { success: false, message: 'Document key missing' };
    }

    const stored = await readStoredObject(s3Key);
    if (!stored) {
      return { success: false, message: 'Failed to download document' };
    }
    const buffer = stored.buffer;
    if (stored.mimeType) mimeType = stored.mimeType;

    void applicationId;

    return {
      success: true,
      message: 'OK',
      data: {
        base64: buffer.toString('base64'),
        mimeType,
        filename,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: 'Failed to fetch document',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
