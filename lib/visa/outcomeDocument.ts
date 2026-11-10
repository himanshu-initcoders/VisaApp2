/**
 * Approved-visa delivery documents (e-visa / expense PDF).
 * Stored under the same passenger-scoped application key path as apply docs.
 */

import 'server-only';

import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { documents } from '@/lib/db/schema';
import {
  buildApplicationObjectKey,
  extensionFromMime,
} from '@/lib/upload/applicationKey';
import {
  deleteOtherSlotExtensionKeys,
  deleteReplacedObjectKey,
} from '@/lib/upload/deleteSlotSiblings';
import { uploadService } from '@/lib/upload';
import { assertSafeStorageKey } from '@/lib/upload/safeStorageKey';
import { VISA_OUTCOME_SLOT } from '@/lib/visa/outcomeDocumentShared';

export {
  VISA_OUTCOME_SLOT,
  VISA_OUTCOME_UPLOAD_TYPES,
  isPdfMime,
  visaOutcomeLabel,
} from '@/lib/visa/outcomeDocumentShared';

export function buildVisaOutcomeObjectKey(input: {
  countryCode: string;
  listingId: string;
  userId: string;
  applicationId: string;
  passengerId: string;
  mimeType: string;
  filename?: string;
}): string {
  return buildApplicationObjectKey({
    countryCode: input.countryCode,
    listingId: input.listingId,
    userId: input.userId,
    applicationId: input.applicationId,
    passengerId: input.passengerId,
    slotKey: VISA_OUTCOME_SLOT,
    ext: extensionFromMime(input.mimeType, input.filename),
  });
}

/** Ensure the uploaded key is under this application + passenger folder. */
export function assertVisaOutcomeKeyForPassenger(
  key: string,
  input: { applicationId: string; passengerId: string; userId: string }
): string {
  const safe = assertSafeStorageKey(key);
  const appNeedle = `/${input.applicationId}/`;
  const passengerNeedle = `/passengers/${input.passengerId}/`;
  if (!safe.includes(appNeedle)) {
    throw new Error('Document key does not match this application');
  }
  if (!safe.includes(passengerNeedle)) {
    throw new Error('Document key does not match this traveller');
  }
  if (!safe.includes(`/${VISA_OUTCOME_SLOT}.`)) {
    throw new Error('Document key is not a visa outcome file');
  }
  if (!safe.includes(`/${input.userId}/`)) {
    throw new Error('Document key does not match the application owner');
  }
  return safe;
}

export async function upsertVisaOutcomeDocumentRow(input: {
  applicationId: string;
  passengerId: string;
  key: string;
  filename: string;
  size: number;
  mimeType: string;
  now?: Date;
}): Promise<{ id: string; s3Key: string; filename: string; mimeType: string }> {
  const now = input.now ?? new Date();
  const rows = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.applicationId, input.applicationId),
        eq(documents.applicationType, 'visa'),
        eq(documents.documentType, VISA_OUTCOME_SLOT)
      )
    );

  const match =
    rows.find(
      (row) =>
        row.s3Key.includes(`/passengers/${input.passengerId}/`) ||
        row.s3Key.includes(input.passengerId)
    ) || undefined;

  if (match) {
    await deleteReplacedObjectKey(match.s3Key, input.key);
    await deleteOtherSlotExtensionKeys(input.key);
    await db
      .update(documents)
      .set({
        s3Key: input.key,
        filename: input.filename,
        fileSize: input.size,
        mimeType: input.mimeType,
        verified: true,
        verificationNotes: null,
        uploadedAt: now,
      })
      .where(eq(documents.id, match.id));
    return {
      id: match.id,
      s3Key: input.key,
      filename: input.filename,
      mimeType: input.mimeType,
    };
  }

  await deleteOtherSlotExtensionKeys(input.key);
  const [inserted] = await db
    .insert(documents)
    .values({
      applicationId: input.applicationId,
      applicationType: 'visa',
      documentType: VISA_OUTCOME_SLOT,
      s3Key: input.key,
      filename: input.filename,
      fileSize: input.size,
      mimeType: input.mimeType,
      verified: true,
      uploadedAt: now,
    })
    .returning({
      id: documents.id,
      s3Key: documents.s3Key,
      filename: documents.filename,
      mimeType: documents.mimeType,
    });

  return {
    id: inserted.id,
    s3Key: inserted.s3Key,
    filename: inserted.filename,
    mimeType: inserted.mimeType || input.mimeType,
  };
}

/** Application ids that already have at least one visa_outcome document. */
export async function loadVisaOutcomePresence(
  applicationIds: string[]
): Promise<Set<string>> {
  if (applicationIds.length === 0) return new Set();
  const rows = await db
    .select({ applicationId: documents.applicationId })
    .from(documents)
    .where(
      and(
        inArray(documents.applicationId, applicationIds),
        eq(documents.applicationType, 'visa'),
        eq(documents.documentType, VISA_OUTCOME_SLOT)
      )
    );
  return new Set(rows.map((row) => row.applicationId));
}

/** Best-effort delete of a just-uploaded object when the parent action fails. */
export async function cleanupVisaOutcomeUpload(key: string): Promise<void> {
  try {
    await uploadService.delete({ key });
  } catch (error) {
    console.warn('[visa-outcome] Failed to clean up upload', key, error);
  }
}
