'use server';

import fs from 'fs/promises';
import path from 'path';
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
import { uploadService } from '@/lib/upload';
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
 * List previous passenger profiles for the signed-in applicant (apply carousel).
 */
export async function listMyApplyPreviousProfiles(): Promise<
  ActionResponse<ApplyPreviousProfile[]>
> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, message: 'Unauthorized' };
    }
    if (
      session.user.role === 'admin' ||
      session.user.role === 'reviewer'
    ) {
      return { success: false, message: 'Unauthorized' };
    }

    const profiles = await getApplyPreviousProfiles(session.user.id);
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
 * Autofill answers + document refs for a passenger against the current listing form.
 */
export async function getMyPassengerAutofill(input: {
  profileId: string;
  formConfig: ApplyFormConfig;
}): Promise<ActionResponse<PassengerAutofillPayload>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, message: 'Unauthorized' };
    }
    if (
      session.user.role === 'admin' ||
      session.user.role === 'reviewer'
    ) {
      return { success: false, message: 'Unauthorized' };
    }

    const profileId = String(input.profileId || '').trim();
    if (!profileId || !input.formConfig) {
      return { success: false, message: 'Missing profile or form config' };
    }

    const payload = await getPassengerAutofillForListing({
      userId: session.user.id,
      profileId,
      formConfig: input.formConfig,
    });

    if (!payload) {
      return { success: false, message: 'Profile not found' };
    }

    return { success: true, message: 'OK', data: payload };
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

    let buffer: Buffer | null = null;

    if (uploadService.getProviderName() === 'local') {
      try {
        const filePath = path.join(process.cwd(), 'public', 'uploads', s3Key);
        buffer = await fs.readFile(filePath);
      } catch {
        buffer = null;
      }
    }

    if (!buffer) {
      const url = uploadService.getUrl(s3Key);
      const absolute =
        url.startsWith('http://') || url.startsWith('https://')
          ? url
          : `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}${url.startsWith('/') ? '' : '/'}${url}`;

      const response = await fetch(absolute);
      if (!response.ok) {
        return { success: false, message: 'Failed to download document' };
      }
      const arrayBuffer = await response.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      const contentType = response.headers.get('content-type');
      if (contentType) mimeType = contentType;
    }

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
