'use server';

import { randomUUID } from 'crypto';
import { and, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { resolveSessionUserId } from '@/lib/auth/session-user';
import { db } from '@/lib/db';
import {
  documents,
  passportApplicationDrafts,
  passportServices,
  payments,
  statusHistory,
} from '@/lib/db/schema';
import { ensurePassportFormVersionForSubmit } from '@/lib/db/queries/passportFormVersions';
import { quotePassportListing } from '@/lib/payments/quote';
import { ensureUniquePassportReferenceNumber } from '@/lib/passport/reference-number';
import {
  getMissingPassportDocuments,
  type PassportApplyFormConfig,
} from '@/lib/apply/passportForm';
import {
  normalizePassportDraftUploads,
  PASSPORT_DRAFT_COUNTRY_CODE,
  PASSPORT_DRAFT_PASSENGER_ID,
  type PassportDraftUpload,
} from '@/lib/apply/passportDraftFiles';
import { promoteDraftFileToApplication } from '@/lib/upload/promoteDraftFile';

export type SubmitPassportInput = {
  submitId: string;
  listingId: string;
  priceOptionId: string;
  answers: Record<string, unknown>;
  /**
   * Draft uploads from /api/apply/draft-files.
   * Accepts `storageKey` (canonical) or legacy `s3Key`.
   */
  uploadedDocuments?: Record<
    string,
    {
      storageKey?: string;
      s3Key?: string;
      filename: string;
      mimeType?: string;
      size?: number;
    }
  >;
  paymentId?: string | null;
};

function validateAnswers(
  answers: Record<string, unknown>,
  config: PassportApplyFormConfig
): string | null {
  for (const step of config.steps) {
    for (const question of step.questions) {
      if (!question.required) continue;
      const value = answers[question.key];
      if (
        value === undefined ||
        value === null ||
        value === '' ||
        (Array.isArray(value) && value.length === 0)
      ) {
        return `Please answer “${question.label}” before submitting.`;
      }
    }
  }
  return null;
}

function validateDocuments(
  uploads: Record<string, PassportDraftUpload>,
  config: PassportApplyFormConfig
): string | null {
  const missing = getMissingPassportDocuments(config.documentSlots, uploads);
  if (missing.length === 0) return null;
  if (missing.length === 1) {
    return `Please upload “${missing[0].label}” before submitting.`;
  }
  return `Please upload required documents: ${missing
    .map((slot) => slot.label)
    .join(', ')}.`;
}

async function promotePassportDraftUploads(input: {
  userId: string;
  listingId: string;
  applicationId: string;
  uploads: Record<string, PassportDraftUpload>;
}): Promise<
  | {
      success: true;
      results: Array<{
        slotKey: string;
        key: string;
        url: string;
        mimeType: string;
        filename: string;
        size: number;
      }>;
    }
  | { success: false; error: string }
> {
  const results: Array<{
    slotKey: string;
    key: string;
    url: string;
    mimeType: string;
    filename: string;
    size: number;
  }> = [];

  for (const [slotKey, file] of Object.entries(input.uploads)) {
    try {
      const promoted = await promoteDraftFileToApplication({
        draftStorageKey: file.storageKey,
        countryCode: PASSPORT_DRAFT_COUNTRY_CODE,
        listingId: input.listingId,
        userId: input.userId,
        applicationId: input.applicationId,
        passengerId: PASSPORT_DRAFT_PASSENGER_ID,
        slotKey,
        filename: file.filename,
        mimeType: file.mimeType,
      });
      results.push({
        slotKey,
        key: promoted.key,
        url: promoted.url,
        mimeType: promoted.mimeType,
        filename: promoted.filename,
        size: promoted.size,
      });
    } catch (error) {
      console.error('[PassportSubmit] Promote failed:', file.storageKey, error);
      return {
        success: false,
        error: `Could not attach “${file.filename || slotKey}”. Go back, re-upload that document, and try again.`,
      };
    }
  }

  return { success: true, results };
}

export async function submitPassportApplication(
  input: SubmitPassportInput
): Promise<
  | { success: true; applicationId: string; referenceNumber: string }
  | { success: false; error: string }
> {
  try {
    const session = await auth();
    const userId = session?.user
      ? await resolveSessionUserId(session.user)
      : null;
    if (!userId) {
      return { success: false, error: 'Sign in to submit your application.' };
    }

    const formVersion = await ensurePassportFormVersionForSubmit(
      input.listingId,
      userId
    );
    if (!formVersion) {
      return {
        success: false,
        error:
          'Passport form not ready. Ask an admin to publish the form version.',
      };
    }

    const config = formVersion.config as PassportApplyFormConfig;
    const draftUploads = normalizePassportDraftUploads(input.uploadedDocuments);

    const validationError = validateAnswers(input.answers, config);
    if (validationError) {
      return { success: false, error: validationError };
    }
    const documentsError = validateDocuments(draftUploads, config);
    if (documentsError) {
      return { success: false, error: documentsError };
    }

    const quoted = await quotePassportListing({
      listingId: input.listingId,
      priceOptionId: input.priceOptionId,
    });
    if (!quoted.ok) {
      return { success: false, error: quoted.error };
    }

    if (quoted.quote.amountPaise > 0) {
      if (!input.paymentId) {
        return { success: false, error: 'Payment is required before submit.' };
      }
      const [payment] = await db
        .select()
        .from(payments)
        .where(
          and(
            eq(payments.id, input.paymentId),
            eq(payments.userId, userId),
            eq(payments.applicationType, 'passport')
          )
        )
        .limit(1);
      if (!payment || payment.status !== 'completed') {
        return {
          success: false,
          error: 'Payment is not completed yet. Finish checkout and try again.',
        };
      }
      if (payment.amount !== quoted.quote.amountPaise) {
        return {
          success: false,
          error: 'Payment amount no longer matches the selected package.',
        };
      }
    }

    // Allocate ids first; promote drafts into the application path before insert
    // so a failed promote never leaves a submitted row with missing files.
    const applicationId = randomUUID();
    const referenceNumber = await ensureUniquePassportReferenceNumber(db);

    const promoted = await promotePassportDraftUploads({
      userId,
      listingId: input.listingId,
      applicationId,
      uploads: draftUploads,
    });
    if (!promoted.success) {
      return { success: false, error: promoted.error };
    }

    const now = new Date();
    const documentsJson = promoted.results.map((row) => ({
      slotKey: row.slotKey,
      key: row.key,
      url: row.url,
      mimeType: row.mimeType,
      filename: row.filename,
      size: row.size,
    }));

    await db.insert(passportServices).values({
      id: applicationId,
      userId,
      serviceType: config.serviceType,
      passportListingId: input.listingId,
      priceOptionId: input.priceOptionId,
      formVersionId: formVersion.id,
      formSnapshot: formVersion.config,
      answers: input.answers,
      referenceNumber,
      status: 'submitted',
      personalInfo: input.answers,
      documents: documentsJson,
      paymentId: input.paymentId || null,
      submittedAt: now,
    });

    if (promoted.results.length > 0) {
      await db.insert(documents).values(
        promoted.results.map((row) => ({
          applicationId,
          applicationType: 'passport' as const,
          documentType: row.slotKey,
          s3Key: row.key,
          filename: row.filename,
          mimeType: row.mimeType || null,
          fileSize: row.size ?? null,
          uploadedAt: now,
        }))
      );
    }

    if (input.paymentId) {
      await db
        .update(payments)
        .set({ applicationId })
        .where(eq(payments.id, input.paymentId));
    }

    await db.insert(statusHistory).values({
      applicationId,
      applicationType: 'passport',
      oldStatus: 'draft',
      newStatus: 'submitted',
      notes: 'Applicant submitted passport application',
      changedBy: userId,
    });

    await db
      .delete(passportApplicationDrafts)
      .where(
        and(
          eq(passportApplicationDrafts.userId, userId),
          eq(passportApplicationDrafts.passportListingId, input.listingId)
        )
      );

    return {
      success: true,
      applicationId,
      referenceNumber,
    };
  } catch (error) {
    console.error('submitPassportApplication error:', error);
    return { success: false, error: 'Failed to submit passport application.' };
  }
}
