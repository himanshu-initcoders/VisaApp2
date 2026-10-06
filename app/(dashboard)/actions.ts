'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { signOut, auth } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  applicationComments,
  correctionItems,
  correctionRequests,
  documents,
  passportServices,
  statusHistory,
  users,
  visaApplicationTravellers,
  visaApplications,
} from '@/lib/db/schema';
import { uploadService } from '@/lib/upload';
import { uploadApplicationDocuments } from '@/lib/upload/application-actions';
import { updateProfileSchema } from '@/lib/validations/auth';
import type { ActionResponse } from '@/types/admin';
import type { ApplyFormConfig } from '@/lib/apply/applicationForm';
import {
  allowedOpenKeys,
  commentBodySchema,
  getOpenCorrection,
  readTargetValue,
  replaceTravellerDocument,
  submitCorrectionSchema,
  validateFieldValue,
  writeFieldValue,
  type StoredTraveller,
} from '@/lib/visa/corrections';
import { recomputeVisaCaseStatus } from '@/lib/visa/travellerStatus';
import {
  markAllNotificationsRead,
  notifyCommentEvent,
  notifyCorrectionResubmittedEvent,
} from '@/lib/notifications';

export async function signOutAction() {
  await signOut({ redirectTo: '/' });
}

/**
 * Applicant self-service profile update.
 *
 * Allowlist only: `name`.
 * Explicitly rejects / ignores role, phone, email, password, and other sensitive fields.
 */
export async function updateMyProfile(
  input: unknown
): Promise<ActionResponse<{ name: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, message: 'Unauthorized' };
    }

    // Staff use the admin panel — keep applicant path user-only
    if (
      session.user.role === 'admin' ||
      session.user.role === 'reviewer'
    ) {
      return { success: false, message: 'Unauthorized' };
    }

    // Strip anything outside the Zod schema (role, phone, email, etc.)
    const raw =
      input && typeof input === 'object'
        ? { name: (input as { name?: unknown }).name }
        : {};

    const parsed = updateProfileSchema.safeParse(raw);
    if (!parsed.success) {
      const first =
        parsed.error.flatten().fieldErrors.name?.[0] ||
        parsed.error.issues[0]?.message ||
        'Invalid input';
      return { success: false, message: first };
    }

    const name = parsed.data.name.trim();

    // Only `name` + `updatedAt` — never role, phone, email, passwordHash, etc.
    const [updated] = await db
      .update(users)
      .set({
        name,
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.user.id))
      .returning({ name: users.name });

    if (!updated) {
      return { success: false, message: 'User not found' };
    }

    revalidatePath('/profile');
    revalidatePath('/dashboard');

    return {
      success: true,
      message: 'Profile updated',
      data: { name: updated.name },
    };
  } catch (error) {
    return {
      success: false,
      message: 'Failed to update profile',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Resolve a document preview URL for the signed-in owner only.
 */
export async function getMyDocumentPreviewUrl(
  documentId: string
): Promise<ActionResponse<{ url: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, message: 'Unauthorized' };
    }

    const [doc] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1);

    if (!doc) {
      return { success: false, message: 'Document not found' };
    }

    const [visaOwner] = await db
      .select({ id: visaApplications.id })
      .from(visaApplications)
      .where(
        and(
          eq(visaApplications.id, doc.applicationId),
          eq(visaApplications.userId, session.user.id)
        )
      )
      .limit(1);

    const [passportOwner] = await db
      .select({ id: passportServices.id })
      .from(passportServices)
      .where(
        and(
          eq(passportServices.id, doc.applicationId),
          eq(passportServices.userId, session.user.id)
        )
      )
      .limit(1);

    if (!visaOwner && !passportOwner) {
      return { success: false, message: 'Unauthorized' };
    }

    const url = uploadService.getUrl(doc.s3Key);
    return {
      success: true,
      message: 'OK',
      data: { url },
    };
  } catch (error) {
    return {
      success: false,
      message: 'Failed to resolve document URL',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

const ALLOWED_CORRECTION_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

function revalidateCorrectionSurfaces(applicationId: string) {
  revalidatePath('/admin');
  revalidatePath('/admin/applications');
  revalidatePath(`/admin/applications/visa/${applicationId}`);
  revalidatePath(`/applications/visa/${applicationId}`);
  revalidatePath(`/applications/visa/${applicationId}/fix`);
  revalidatePath('/applications');
  revalidatePath('/dashboard');
}

export async function markNotificationsRead(): Promise<ActionResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: 'Unauthorized' };
  }
  if (session.user.role === 'admin' || session.user.role === 'reviewer') {
    return { success: false, message: 'Unauthorized' };
  }
  await markAllNotificationsRead(session.user.id);
  revalidatePath('/dashboard');
  return { success: true, message: 'Notifications marked read' };
}

export async function postApplicantComment(
  input: unknown
): Promise<ActionResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role === 'admin' || session.user.role === 'reviewer') {
      return { success: false, message: 'Unauthorized' };
    }

    const parsed = commentBodySchema.safeParse(input);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Comment is required';
      return { success: false, message, error: message };
    }

    const { applicationId, body } = parsed.data;
    const [application] = await db
      .select({ id: visaApplications.id })
      .from(visaApplications)
      .where(
        and(
          eq(visaApplications.id, applicationId),
          eq(visaApplications.userId, session.user.id)
        )
      )
      .limit(1);
    if (!application) {
      return { success: false, message: 'Application not found' };
    }

    const [user] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    await db.insert(applicationComments).values({
      applicationId,
      authorId: session.user.id,
      authorRole: 'applicant',
      body,
      createdAt: new Date(),
    });

    revalidateCorrectionSurfaces(applicationId);
    try {
      await notifyCommentEvent({
        applicationId,
        authorId: session.user.id,
        authorName: user?.name || session.user.name || 'Applicant',
        authorRole: 'applicant',
        body,
      });
    } catch (notifyError) {
      console.error('Comment notification failed', notifyError);
    }

    return { success: true, message: 'Comment posted' };
  } catch (error) {
    console.error('Error posting applicant comment:', error);
    return {
      success: false,
      message: 'Failed to post comment',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Save only the fields and documents an open correction request unlocked.
 * Any other key is rejected.
 */
export async function submitCorrection(
  input: unknown
): Promise<ActionResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role === 'admin' || session.user.role === 'reviewer') {
      return { success: false, message: 'Unauthorized' };
    }

    const parsed = submitCorrectionSchema.safeParse(input);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Invalid update';
      return { success: false, message, error: message };
    }

    const { applicationId, travellerId, fields, files } = parsed.data;
    const [application] = await db
      .select()
      .from(visaApplications)
      .where(
        and(
          eq(visaApplications.id, applicationId),
          eq(visaApplications.userId, session.user.id)
        )
      )
      .limit(1);
    if (!application) {
      return { success: false, message: 'Application not found' };
    }

    const [traveller] = await db
      .select()
      .from(visaApplicationTravellers)
      .where(
        and(
          eq(visaApplicationTravellers.id, travellerId),
          eq(visaApplicationTravellers.applicationId, applicationId)
        )
      )
      .limit(1);
    if (!traveller) {
      return { success: false, message: 'Traveller not found' };
    }

    const open = await getOpenCorrection(applicationId, travellerId);
    if (!open) {
      return { success: false, message: 'Nothing is waiting for an update' };
    }

    const allowed = allowedOpenKeys(open.items);
    const itemByKey = new Map(open.items.map((item) => [item.targetKey, item]));
    const fieldKeys = Object.keys(fields);
    const fileKeys = files.map((file) => file.slotKey);
    const submitted = new Set([...fieldKeys, ...fileKeys]);

    for (const key of submitted) {
      if (!allowed.has(key)) {
        return {
          success: false,
          message: 'Only the requested fields can be changed',
        };
      }
    }
    for (const key of allowed) {
      if (!submitted.has(key)) {
        return {
          success: false,
          message: 'Update every requested item before sending',
        };
      }
    }
    if (fieldKeys.length + fileKeys.length !== submitted.size) {
      return { success: false, message: 'Duplicate update' };
    }

    const config = (application.formSnapshot as ApplyFormConfig | null) ?? null;
    const storedTravellers = Array.isArray(application.travellers)
      ? (application.travellers as StoredTraveller[])
      : [];
    const travellerIndex = storedTravellers.findIndex(
      (item) => item.passengerId === traveller.passengerId
    );
    if (travellerIndex < 0) {
      return { success: false, message: 'Traveller details were not found' };
    }

    let nextTraveller = storedTravellers[travellerIndex];
    for (const key of fieldKeys) {
      const item = itemByKey.get(key);
      if (!item || item.kind !== 'field') {
        return { success: false, message: 'Only the requested fields can be changed' };
      }
      const value = fields[key] ?? '';
      const issue = validateFieldValue(config, key, value);
      if (issue) return { success: false, message: issue };
      const previous = readTargetValue(nextTraveller, key);
      if (String(previous ?? '').trim() === value.trim()) {
        return {
          success: false,
          message: 'Change each requested field before sending',
        };
      }
      nextTraveller = writeFieldValue(nextTraveller, key, value.trim());
    }

    for (const file of files) {
      const item = itemByKey.get(file.slotKey);
      if (!item || item.kind !== 'document') {
        return { success: false, message: 'Only the requested documents can be replaced' };
      }
      if (!ALLOWED_CORRECTION_MIME.has(file.mimeType)) {
        return { success: false, message: 'Upload a JPG, PNG, WEBP, or PDF' };
      }
      const bytes = Buffer.from(file.bufferBase64, 'base64');
      const max = file.mimeType === 'application/pdf' ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
      if (bytes.length === 0 || bytes.length > max) {
        return { success: false, message: 'File is empty or too large' };
      }
    }

    if (!application.countryCode || !application.visaListingId) {
      return { success: false, message: 'This application cannot accept new files' };
    }

    const uploadResult = files.length
      ? await uploadApplicationDocuments({
          countryCode: application.countryCode,
          listingId: application.visaListingId,
          applicationId,
          documents: files.map((file) => ({
            passengerId: traveller.passengerId,
            slotKey: file.slotKey,
            filename: file.filename,
            mimeType: file.mimeType,
            bufferBase64: file.bufferBase64,
          })),
        })
      : { success: true as const, results: [] };

    if (!uploadResult.success) {
      return {
        success: false,
        message: uploadResult.error || 'Document upload failed',
      };
    }

    const now = new Date();
    for (const uploaded of uploadResult.results) {
      nextTraveller = replaceTravellerDocument(nextTraveller, uploaded.slotKey, {
        slotKey: uploaded.slotKey,
        key: uploaded.key,
        url: uploaded.url,
        mimeType: uploaded.mimeType,
        filename: uploaded.filename,
        size: uploaded.size,
      });
    }

    const nextTravellers = storedTravellers.map((item, index) =>
      index === travellerIndex ? nextTraveller : item
    );
    const summary = Array.isArray(application.documents)
      ? [...(application.documents as Array<Record<string, unknown>>)]
      : [];
    for (const uploaded of uploadResult.results) {
      const entry = {
        key: uploaded.key,
        url: uploaded.url,
        slotKey: uploaded.slotKey,
        passengerId: uploaded.passengerId,
      };
      const existing = summary.findIndex(
        (item) =>
          item.slotKey === uploaded.slotKey &&
          item.passengerId === uploaded.passengerId
      );
      if (existing >= 0) summary[existing] = entry;
      else summary.push(entry);
    }

    const personal =
      application.personalInfo &&
      typeof application.personalInfo === 'object' &&
      !Array.isArray(application.personalInfo)
        ? { ...(application.personalInfo as Record<string, unknown>) }
        : null;
    if (personal && Array.isArray(personal.travellers)) {
      personal.travellers = nextTravellers;
    }

    await db.transaction(async (tx) => {
      await tx
        .update(visaApplications)
        .set({
          travellers: nextTravellers,
          documents: summary,
          ...(personal ? { personalInfo: personal } : {}),
          updatedAt: now,
        })
        .where(eq(visaApplications.id, applicationId));

      if (uploadResult.results.length > 0) {
        await tx.insert(documents).values(
          uploadResult.results.map((uploaded) => ({
            applicationId,
            applicationType: 'visa' as const,
            documentType: uploaded.slotKey,
            s3Key: uploaded.key,
            filename: uploaded.filename,
            fileSize: uploaded.size,
            mimeType: uploaded.mimeType,
            verified: null,
            uploadedAt: now,
          }))
        );
      }

      for (const item of open.items) {
        const newValue =
          item.kind === 'field'
            ? fields[item.targetKey]
            : uploadResult.results.find((file) => file.slotKey === item.targetKey) ??
              null;
        await tx
          .update(correctionItems)
          .set({ status: 'resubmitted', newValue })
          .where(eq(correctionItems.id, item.id));
      }

      await tx
        .update(correctionRequests)
        .set({ status: 'resubmitted', resubmittedAt: now })
        .where(eq(correctionRequests.id, open.request.id));

      await tx
        .update(visaApplicationTravellers)
        .set({ status: 'under_review', updatedAt: now })
        .where(eq(visaApplicationTravellers.id, travellerId));

      await tx.insert(statusHistory).values({
        applicationId,
        applicationType: 'visa',
        travellerId,
        oldStatus: traveller.status,
        newStatus: 'under_review',
        changedBy: session.user.id,
        notes: 'Applicant sent the requested updates',
        createdAt: now,
      });

      await tx.insert(applicationComments).values({
        applicationId,
        travellerId,
        authorId: session.user.id,
        authorRole: 'applicant',
        body: 'I sent the requested updates.',
        createdAt: now,
      });
    });

    await recomputeVisaCaseStatus(applicationId);
    revalidateCorrectionSurfaces(applicationId);
    try {
      await notifyCorrectionResubmittedEvent({
        applicationId,
        excludeUserId: session.user.id,
      });
    } catch (notifyError) {
      console.error('Resubmit notification failed', notifyError);
    }

    return { success: true, message: 'Updates sent' };
  } catch (error) {
    console.error('Error submitting correction:', error);
    return {
      success: false,
      message: 'Failed to send updates',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
