'use server';

import { and, eq } from 'drizzle-orm';
import { requireRole } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import {
  visaApplications,
  visaApplicationTravellers,
} from '@/lib/db/schema';
import { uploadService } from '@/lib/upload';
import { APPLICATION_UPLOAD_FOLDER } from '@/lib/upload/applicationKey';
import { reviewerOwnsVisa } from '@/lib/reviewer-access';
import { buildVisaOutcomeObjectKey } from '@/lib/visa/outcomeDocument';
import {
  VISA_OUTCOME_UPLOAD_TYPES,
  isPdfMime,
} from '@/lib/visa/outcomeDocumentShared';

function decodeBase64(base64: string): Buffer {
  return Buffer.from(base64, 'base64');
}

export async function uploadVisaOutcomeFile(input: {
  applicationId: string;
  travellerId: string;
  filename: string;
  mimeType: string;
  bufferBase64: string;
  /** When true, only application/pdf is accepted. */
  requirePdf?: boolean;
}): Promise<
  | {
      success: true;
      key: string;
      filename: string;
      mimeType: string;
      size: number;
    }
  | { success: false; error: string }
> {
  try {
    const session = await requireRole(['admin', 'reviewer']);
    if (!input.applicationId || !input.travellerId) {
      return { success: false, error: 'Application and traveller are required' };
    }

    if (
      session.user.role === 'reviewer' &&
      !(await reviewerOwnsVisa(session.user.id, input.applicationId))
    ) {
      return { success: false, error: 'Application not found' };
    }

    const mimeType = (input.mimeType || '').toLowerCase();
    if (input.requirePdf && !isPdfMime(mimeType)) {
      return {
        success: false,
        error: 'Only PDF files can be sent on WhatsApp and email',
      };
    }
    if (
      !VISA_OUTCOME_UPLOAD_TYPES.includes(
        mimeType as (typeof VISA_OUTCOME_UPLOAD_TYPES)[number]
      )
    ) {
      return {
        success: false,
        error: 'Allowed types: PDF, JPG, PNG, WebP',
      };
    }

    const [traveller] = await db
      .select({
        id: visaApplicationTravellers.id,
        passengerId: visaApplicationTravellers.passengerId,
        applicationId: visaApplicationTravellers.applicationId,
      })
      .from(visaApplicationTravellers)
      .where(
        and(
          eq(visaApplicationTravellers.id, input.travellerId),
          eq(visaApplicationTravellers.applicationId, input.applicationId)
        )
      )
      .limit(1);

    if (!traveller) {
      return { success: false, error: 'Traveller not found' };
    }

    const [app] = await db
      .select({
        id: visaApplications.id,
        userId: visaApplications.userId,
        countryCode: visaApplications.countryCode,
        visaListingId: visaApplications.visaListingId,
      })
      .from(visaApplications)
      .where(eq(visaApplications.id, input.applicationId))
      .limit(1);

    if (!app) {
      return { success: false, error: 'Application not found' };
    }

    const buffer = decodeBase64(input.bufferBase64);
    const maxSizeMB = isPdfMime(mimeType) ? 10 : 5;
    if (buffer.byteLength > maxSizeMB * 1024 * 1024) {
      return {
        success: false,
        error: `File must be under ${maxSizeMB}MB`,
      };
    }

    const explicitKey = buildVisaOutcomeObjectKey({
      countryCode: app.countryCode || 'XX',
      listingId: app.visaListingId || 'unknown',
      userId: app.userId,
      applicationId: app.id,
      passengerId: traveller.passengerId,
      mimeType,
      filename: input.filename,
    });

    const result = await uploadService.upload(buffer, {
      folder: APPLICATION_UPLOAD_FOLDER,
      filename: input.filename,
      explicitKey,
      maxSizeMB,
      allowedTypes: [...VISA_OUTCOME_UPLOAD_TYPES],
      metadata: {
        passengerId: traveller.passengerId,
        slotKey: 'visa_outcome',
        applicationId: app.id,
      },
    });

    return {
      success: true,
      key: result.key,
      filename: result.filename || input.filename,
      mimeType: result.mimeType || mimeType,
      size: result.size,
    };
  } catch (error) {
    console.error('uploadVisaOutcomeFile error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
}
