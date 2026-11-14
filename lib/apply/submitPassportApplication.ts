/**
 * Submit passport application by flipping draft → submitted on the same row.
 * Files already live under the application storage path — no promote/copy.
 */

'use server';

import { and, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { resolveSessionUserId } from '@/lib/auth/session-user';
import { db } from '@/lib/db';
import {
  documents,
  passportServices,
  payments,
  statusHistory,
  users,
} from '@/lib/db/schema';
import { ensurePassportFormVersionForSubmit } from '@/lib/db/queries/passportFormVersions';
import { quotePassportListing } from '@/lib/payments/quote';
import {
  getMissingPassportDocuments,
  type PassportApplyFormConfig,
} from '@/lib/apply/passportForm';
import {
  normalizePassportDraftUploads,
  type PassportDraftUpload,
} from '@/lib/apply/passportDraftFiles';
import { notifyPassportSubmittedEvent } from '@/lib/notifications';
import { passportServiceTypeLabel } from '@/lib/passport/constants';

export type SubmitPassportInput = {
  submitId: string;
  listingId: string;
  priceOptionId: string;
  answers: Record<string, unknown>;
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
  /** Existing draft application id (required). */
  applicationId: string;
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

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export async function submitPassportApplication(
  input: SubmitPassportInput
): Promise<
  | {
      success: true;
      applicationId: string;
      referenceNumber: string;
      alreadySubmitted?: boolean;
    }
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

    if (!input.applicationId || !isUuid(input.applicationId)) {
      return { success: false, error: 'Missing draft application id.' };
    }

    const [draftApp] = await db
      .select()
      .from(passportServices)
      .where(eq(passportServices.id, input.applicationId))
      .limit(1);

    if (!draftApp || draftApp.userId !== userId) {
      return { success: false, error: 'Draft application not found.' };
    }
    if (draftApp.passportListingId !== input.listingId) {
      return { success: false, error: 'Application listing mismatch.' };
    }

    if (draftApp.status !== 'draft') {
      return {
        success: true,
        applicationId: draftApp.id,
        referenceNumber: draftApp.referenceNumber || '',
        alreadySubmitted: true,
      };
    }

    if (input.submitId && isUuid(input.submitId)) {
      const [bySubmit] = await db
        .select({
          id: passportServices.id,
          referenceNumber: passportServices.referenceNumber,
          userId: passportServices.userId,
        })
        .from(passportServices)
        .where(eq(passportServices.submitId, input.submitId))
        .limit(1);
      if (bySubmit && bySubmit.id !== draftApp.id) {
        if (bySubmit.userId !== userId) {
          return {
            success: false,
            error: 'This submission belongs to another account.',
          };
        }
        return {
          success: true,
          applicationId: bySubmit.id,
          referenceNumber: bySubmit.referenceNumber || '',
          alreadySubmitted: true,
        };
      }
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

    const now = new Date();
    const applicationId = draftApp.id;
    const referenceNumber = draftApp.referenceNumber || '';

    const documentsJson = Object.entries(draftUploads).map(([slotKey, file]) => ({
      slotKey,
      key: file.storageKey,
      url: '',
      mimeType: file.mimeType,
      filename: file.filename,
      size: file.size,
    }));

    await db
      .update(passportServices)
      .set({
        serviceType: config.serviceType,
        priceOptionId: input.priceOptionId,
        formVersionId: formVersion.id,
        formSnapshot: formVersion.config,
        answers: input.answers,
        status: 'submitted',
        personalInfo: input.answers,
        documents: documentsJson,
        submitId: input.submitId || null,
        paymentId: input.paymentId || null,
        submittedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(passportServices.id, applicationId),
          eq(passportServices.status, 'draft')
        )
      );

    for (const row of documentsJson) {
      if (!row.key) continue;
      const existingDocs = await db
        .select({ id: documents.id, s3Key: documents.s3Key })
        .from(documents)
        .where(
          and(
            eq(documents.applicationId, applicationId),
            eq(documents.applicationType, 'passport'),
            eq(documents.documentType, row.slotKey)
          )
        );

      const match =
        existingDocs.find((d) => d.s3Key === row.key) ||
        (existingDocs.length === 1 ? existingDocs[0] : undefined);

      if (match) {
        await db
          .update(documents)
          .set({
            s3Key: row.key,
            filename: row.filename || `${row.slotKey}.bin`,
            mimeType: row.mimeType || null,
            fileSize: row.size ?? null,
            verified: null,
            uploadedAt: now,
          })
          .where(eq(documents.id, match.id));
      } else {
        await db.insert(documents).values({
          applicationId,
          applicationType: 'passport',
          documentType: row.slotKey,
          s3Key: row.key,
          filename: row.filename || `${row.slotKey}.bin`,
          mimeType: row.mimeType || null,
          fileSize: row.size ?? null,
          uploadedAt: now,
        });
      }
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
      createdAt: now,
    });

    const [userRow] = await db
      .select({
        id: users.id,
        email: users.email,
        phone: users.phone,
        name: users.name,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const answers = input.answers as Record<string, unknown>;
    const given =
      typeof answers.givenNames === 'string' ? answers.givenNames.trim() : '';
    const surname =
      typeof answers.surname === 'string' ? answers.surname.trim() : '';
    const applicantName =
      `${given} ${surname}`.trim() || userRow?.name?.trim() || 'Applicant';
    const serviceType = passportServiceTypeLabel(config.serviceType);
    const productName = config.productName?.trim() || serviceType;

    try {
      await notifyPassportSubmittedEvent({
        applicationId,
        userId,
        applicantName,
        serviceType,
        productName,
        referenceNumber,
        accountEmail: userRow?.email ?? null,
        accountPhone: userRow?.phone ?? null,
      });
    } catch (notifyError) {
      console.error('Passport submit notification failed', notifyError);
    }

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
