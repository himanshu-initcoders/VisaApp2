'use server';

import { revalidatePath } from 'next/cache';
import { hash } from 'bcryptjs';
import { db } from '@/lib/db';
import {
  visaApplications,
  visaApplicationTravellers,
  passportServices,
  documents,
  statusHistory,
  users,
  applicationNotes,
  applicationCallLogs,
  applicationComments,
  applicationCredentials,
  applicationCredentialReveals,
  correctionItems,
  correctionRequests,
  staffFieldEdits,
  payments,
} from '@/lib/db/schema';
import { and, asc, eq, ilike, inArray, isNull, ne, or, sql } from 'drizzle-orm';
import { signOut } from '@/lib/auth';
import { requireRole, isValidStatusTransition, isAdmin } from '@/lib/auth-utils';
import { normalizeIndianPhone } from '@/lib/auth/phone';
import {
  notifyReviewerAssigned,
  notifyPassportReviewerAssigned,
  notifyReviewerWelcome,
} from '@/lib/email/notify';
import {
  notifyReviewerAssignedWhatsApp,
  notifyPassportReviewerAssignedWhatsApp,
  notifyReviewerWelcomeWhatsApp,
} from '@/lib/whatsapp/notify';
import {
  createReviewerSchema,
  updateProfileSchema,
} from '@/lib/validations/auth';
import { recomputeVisaCaseStatus } from '@/lib/visa/travellerStatus';
import {
  buildCorrectableTargets,
  commentBodySchema,
  getOpenCorrection,
  readTargetValue,
  replaceTravellerDocument,
  requestCorrectionSchema,
  resolveCorrectionSchema,
  reviewerAccessDenied,
  staffFieldEditSchema,
  validateFieldValue,
  validateRequestedItems,
  writeFieldValue,
  type StoredTraveller,
} from '@/lib/visa/corrections';
import type { ApplyFormConfig } from '@/lib/apply/applicationForm';
import {
  notifyCommentEvent,
  notifyCorrectionRequestedEvent,
  notifyPassportCorrectionRequestedEvent,
  notifyStatusChangedEvent,
  notifyVisaOutcomeDeliveredEvent,
} from '@/lib/notifications';
import {
  buildPassportCorrectableTargets,
  getOpenPassportCorrection,
  readPassportAnswerValue,
  readPassportTargetValue,
  replacePassportDocument,
  requestPassportCorrectionSchema,
  staffPassportFieldEditSchema,
  validatePassportFieldValue,
  validatePassportRequestedItems,
  writePassportAnswerValue,
  type StoredPassportDocument,
} from '@/lib/passport/corrections';
import { passportServiceTypeLabel } from '@/lib/passport/constants';
import type { PassportApplyFormConfig } from '@/lib/apply/passportForm';
import {
  PASSPORT_DRAFT_COUNTRY_CODE,
  PASSPORT_DRAFT_PASSENGER_ID,
} from '@/lib/apply/passportDraftFiles';
import { uploadService } from '@/lib/upload';
import { uploadApplicationDocuments } from '@/lib/upload/application-actions';
import {
  deleteOtherSlotExtensionKeys,
  deleteReplacedObjectKey,
} from '@/lib/upload/deleteSlotSiblings';
import { upsertApplicationDocumentRow } from '@/lib/upload/upsertApplicationDocumentRow';
import {
  assertVisaOutcomeKeyForPassenger,
  cleanupVisaOutcomeUpload,
  upsertVisaOutcomeDocumentRow,
} from '@/lib/visa/outcomeDocument';
import { isPdfMime } from '@/lib/visa/outcomeDocumentShared';
import {
  reviewerOwnsApplication,
  reviewerOwnsDocument,
  reviewerOwnsVisa,
} from '@/lib/reviewer-access';
import { decryptPassword, encryptPassword } from '@/lib/credentials/crypto';
import {
  revealApplicationCredentialSchema,
  saveApplicationCredentialSchema,
} from '@/lib/credentials/schema';
import {
  attachRazorpayRefundId,
  callRazorpayRefund,
  markLocalRefundFailed,
  remainingRefundablePaise,
} from '@/lib/payments/refund';
import { formatInrFromPaise } from '@/lib/payments/money';
import type {
  ActionResponse,
  AttachVisaOutcomeRequest,
  InitiateVisaRefundRequest,
  StatusUpdateRequest,
  DocumentVerificationRequest,
  AddNoteRequest,
  AddCallLogRequest,
  UpdateUserRoleRequest,
  SetUserDeactivatedRequest,
  ReviewerOption,
} from '@/types/admin';

/**
 * Admin Server Actions
 *
 * All admin mutations with proper authorization and audit logging
 * Each action uses requireRole(['admin', 'reviewer']) for security
 */

/** Clears the staff session and returns to the home page. */
export async function signOutAction() {
  await signOut({ redirectTo: '/' });
}

/**
 * Staff self-service profile update (admin / reviewer).
 * Always allows `name`. Phone can be set only when the account has none yet.
 */
export async function updateStaffProfile(
  input: unknown
): Promise<ActionResponse<{ name: string; phone: string | null }>> {
  try {
    const session = await requireRole(['admin', 'reviewer']);

    const [current] = await db
      .select({
        id: users.id,
        phone: users.phone,
      })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!current) {
      return { success: false, message: 'User not found' };
    }

    const raw =
      input && typeof input === 'object'
        ? {
            name: (input as { name?: unknown }).name,
            phone: (input as { phone?: unknown }).phone,
          }
        : {};

    const parsed = updateProfileSchema.safeParse({ name: raw.name });
    if (!parsed.success) {
      const first =
        parsed.error.flatten().fieldErrors.name?.[0] ||
        parsed.error.issues[0]?.message ||
        'Invalid input';
      return { success: false, message: first };
    }

    const name = parsed.data.name.trim();
    const patch: {
      name: string;
      updatedAt: Date;
      phone?: string;
      phoneVerified?: Date;
    } = {
      name,
      updatedAt: new Date(),
    };

    // Only allow adding a mobile when none is stored yet.
    if (!current.phone) {
      const phoneRaw =
        typeof raw.phone === 'string' ? raw.phone.trim() : '';
      if (phoneRaw) {
        const phone = normalizeIndianPhone(phoneRaw);
        if (!phone) {
          return {
            success: false,
            message: 'Enter a valid 10-digit Indian mobile number',
          };
        }

        const [taken] = await db
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.phone, phone), ne(users.id, current.id)))
          .limit(1);

        if (taken) {
          return {
            success: false,
            message: 'This mobile number is already linked to another account',
          };
        }

        patch.phone = phone;
        patch.phoneVerified = new Date();
      }
    }

    const [updated] = await db
      .update(users)
      .set(patch)
      .where(eq(users.id, session.user.id))
      .returning({ name: users.name, phone: users.phone });

    if (!updated) {
      return { success: false, message: 'User not found' };
    }

    revalidatePath('/admin/profile');
    revalidatePath('/admin');

    return {
      success: true,
      message: 'Profile updated',
      data: { name: updated.name, phone: updated.phone },
    };
  } catch (error) {
    return {
      success: false,
      message: 'Failed to update profile',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function denyReviewerUnlessAssigned(
  session: { user: { id: string; role?: string } },
  applicationId: string,
  applicationType: 'visa' | 'passport'
): Promise<ActionResponse | null> {
  if (session.user.role !== 'reviewer') return null;
  const allowed = await reviewerOwnsApplication(
    session.user.id,
    applicationId,
    applicationType
  );
  if (!allowed) {
    return { success: false, message: 'Application not found' };
  }
  return null;
}

/**
 * Update application status with validation and audit logging
 */
export async function updateApplicationStatus(
  request: StatusUpdateRequest
): Promise<ActionResponse> {
  try {
    // Authorization check
    const session = await requireRole(['admin', 'reviewer']);

    const {
      applicationId,
      applicationType,
      newStatus,
      notes,
      travellerId,
      deliveryDocumentKey,
      deliveryFilename,
      deliveryMimeType,
      deliveryFileSize,
      sendDeliveryToChannels,
    } = request;

    // Validation
    if (!applicationId || !applicationType || !newStatus) {
      return {
        success: false,
        message: 'Missing required fields',
        error: 'applicationId, applicationType, and newStatus are required',
      };
    }

    if (applicationType === 'visa' && !travellerId) {
      return {
        success: false,
        message: 'Traveller is required',
        error: 'travellerId is required when updating a visa status',
      };
    }

    if (sendDeliveryToChannels) {
      if (!deliveryDocumentKey) {
        return {
          success: false,
          message: 'Attach a PDF to send on WhatsApp and email',
          error: 'deliveryDocumentKey required when sendDeliveryToChannels is set',
        };
      }
      if (!isPdfMime(deliveryMimeType)) {
        return {
          success: false,
          message: 'Only PDF files can be sent on WhatsApp and email',
          error: 'PDF required when sendDeliveryToChannels is set',
        };
      }
    }

    const denied = await denyReviewerUnlessAssigned(
      session,
      applicationId,
      applicationType
    );
    if (denied) return denied;

    // Get current application
    let currentStatus: string;
    let travellerReviewedAt: Date | null = null;
    let travellerPassengerId: string | null = null;
    if (applicationType === 'visa') {
      const result = await db
        .select()
        .from(visaApplicationTravellers)
        .where(
          and(
            eq(visaApplicationTravellers.id, travellerId!),
            eq(visaApplicationTravellers.applicationId, applicationId)
          )
        )
        .limit(1);

      if (!result || result.length === 0) {
        return {
          success: false,
          message: 'Traveller not found',
          error: 'Visa traveller does not exist on this application',
        };
      }

      currentStatus = result[0].status;
      travellerReviewedAt = result[0].reviewedAt;
      travellerPassengerId = result[0].passengerId;
    } else {
      const result = await db
        .select()
        .from(passportServices)
        .where(eq(passportServices.id, applicationId))
        .limit(1);

      if (!result || result.length === 0) {
        return {
          success: false,
          message: 'Application not found',
          error: 'Passport application does not exist',
        };
      }

      currentStatus = result[0].status;
    }

    // Validate status transition
    if (!isValidStatusTransition(currentStatus, newStatus)) {
      return {
        success: false,
        message: 'Invalid status transition',
        error: `Cannot change status from ${currentStatus} to ${newStatus}`,
      };
    }

    // Require notes for rejection
    if (newStatus === 'rejected' && (!notes || notes.trim() === '')) {
      return {
        success: false,
        message: 'Notes required for rejection',
        error: 'Please provide a reason for rejecting this application',
      };
    }

    if (
      deliveryDocumentKey &&
      (applicationType !== 'visa' || newStatus !== 'approved')
    ) {
      return {
        success: false,
        message: 'Delivery files are only allowed when approving a visa',
        error: 'Invalid delivery document for this status change',
      };
    }

    let deliveryPayload: {
      documentId: string;
      s3Key: string;
      filename: string;
      mimeType: string;
      sendToChannels: boolean;
    } | null = null;

    if (
      applicationType === 'visa' &&
      newStatus === 'approved' &&
      deliveryDocumentKey &&
      travellerPassengerId
    ) {
      const [appOwner] = await db
        .select({ userId: visaApplications.userId })
        .from(visaApplications)
        .where(eq(visaApplications.id, applicationId))
        .limit(1);
      if (!appOwner) {
        return {
          success: false,
          message: 'Application not found',
          error: 'Visa application missing',
        };
      }
      try {
        const safeKey = assertVisaOutcomeKeyForPassenger(deliveryDocumentKey, {
          applicationId,
          passengerId: travellerPassengerId,
          userId: appOwner.userId,
        });
        const row = await upsertVisaOutcomeDocumentRow({
          applicationId,
          passengerId: travellerPassengerId,
          key: safeKey,
          filename: deliveryFilename || 'visa-document.pdf',
          size: deliveryFileSize || 0,
          mimeType: deliveryMimeType || 'application/pdf',
        });
        deliveryPayload = {
          documentId: row.id,
          s3Key: row.s3Key,
          filename: row.filename,
          mimeType: row.mimeType,
          sendToChannels: Boolean(sendDeliveryToChannels),
        };
      } catch (deliveryError) {
        await cleanupVisaOutcomeUpload(deliveryDocumentKey);
        return {
          success: false,
          message:
            deliveryError instanceof Error
              ? deliveryError.message
              : 'Invalid delivery document',
          error: 'deliveryDocumentKey validation failed',
        };
      }
    }

    const now = new Date();

    if (applicationType === 'visa') {
      await db
        .update(visaApplicationTravellers)
        .set({
          status: newStatus,
          updatedAt: now,
          ...(newStatus === 'under_review' && !travellerReviewedAt
            ? { reviewedAt: now }
            : {}),
          ...(newStatus === 'approved' || newStatus === 'rejected'
            ? { completedAt: now }
            : {}),
          ...(newStatus === 'submitted' ? { completedAt: null } : {}),
        })
        .where(eq(visaApplicationTravellers.id, travellerId!));

      await db.insert(statusHistory).values({
        applicationId,
        applicationType,
        travellerId,
        oldStatus: currentStatus,
        newStatus,
        changedBy: session.user.id,
        notes: notes || null,
        createdAt: now,
      });

      await recomputeVisaCaseStatus(applicationId);
    } else {
      await db
        .update(passportServices)
        .set({
          status: newStatus,
          updatedAt: now,
          ...(newStatus === 'approved' || newStatus === 'rejected'
            ? { completedAt: now }
            : {}),
        })
        .where(eq(passportServices.id, applicationId));

      await db.insert(statusHistory).values({
        applicationId,
        applicationType,
        travellerId: null,
        oldStatus: currentStatus,
        newStatus,
        changedBy: session.user.id,
        notes: notes || null,
        createdAt: now,
      });
    }

    // Revalidate pages
    revalidatePath('/admin/applications');
    revalidatePath(`/admin/applications/${applicationType}/${applicationId}`);
    revalidatePath(`/applications/${applicationType}/${applicationId}`);
    revalidatePath('/applications');
    revalidatePath('/dashboard');
    try {
      await notifyStatusChangedEvent({
        applicationId,
        actorId: session.user.id,
        newStatus,
        notes,
        travellerId:
          applicationType === 'visa' ? travellerId : undefined,
        delivery: deliveryPayload,
        applicationType,
      });
    } catch (notifyError) {
      console.error('Status notification failed', notifyError);
    }

    return {
      success: true,
      message: `Status updated to ${newStatus}`,
    };
  } catch (error) {
    console.error('Error updating application status:', error);
    return {
      success: false,
      message: 'Failed to update status',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Initiate a Razorpay refund for a completed charge (visa or passport).
 */
export async function initiateApplicationRefund(
  request: InitiateVisaRefundRequest & { applicationType: 'visa' | 'passport' }
): Promise<ActionResponse> {
  try {
    const session = await requireRole(['admin', 'reviewer']);
    const { applicationId, parentPaymentId, amountPaise, reason, applicationType } =
      request;

    if (!applicationId || !parentPaymentId) {
      return {
        success: false,
        message: 'Missing required fields',
        error: 'applicationId and parentPaymentId are required',
      };
    }

    const reasonText = (reason || '').trim();
    if (!reasonText || reasonText.length > 1000) {
      return {
        success: false,
        message: 'Enter a refund reason (max 1000 characters)',
        error: 'Invalid reason',
      };
    }

    if (!Number.isInteger(amountPaise) || amountPaise <= 0) {
      return {
        success: false,
        message: 'Enter a valid refund amount greater than zero',
        error: 'Invalid amountPaise',
      };
    }

    const denied = await denyReviewerUnlessAssigned(
      session,
      applicationId,
      applicationType
    );
    if (denied) return denied;

    const [parent] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, parentPaymentId))
      .limit(1);

    if (
      !parent ||
      parent.applicationId !== applicationId ||
      parent.applicationType !== applicationType ||
      parent.kind !== 'charge' ||
      parent.status !== 'completed' ||
      !parent.razorpayPaymentId
    ) {
      return {
        success: false,
        message: 'No completed charge payment found to refund',
        error: 'Invalid parent payment',
      };
    }

    if (amountPaise > parent.amount) {
      return {
        success: false,
        message: `Refund cannot exceed the original amount of ${formatInrFromPaise(parent.amount)}`,
        error: 'amountPaise exceeds original payment',
      };
    }

    const remaining = await remainingRefundablePaise(parent.id);
    if (!remaining) {
      return {
        success: false,
        message: 'Could not verify refundable balance',
        error: 'Parent payment missing',
      };
    }
    if (amountPaise > remaining.remainingPaise) {
      return {
        success: false,
        message: `Refund cannot exceed the remaining refundable amount of ${formatInrFromPaise(remaining.remainingPaise)} (original ${formatInrFromPaise(parent.amount)})`,
        error: 'amountPaise exceeds remaining refundable',
      };
    }

    const [created] = await db
      .insert(payments)
      .values({
        userId: parent.userId,
        applicationId: parent.applicationId,
        applicationType: parent.applicationType,
        amount: amountPaise,
        currency: parent.currency || 'INR',
        status: 'proceed',
        kind: 'refund',
        parentPaymentId: parent.id,
        razorpayPaymentId: parent.razorpayPaymentId,
        submitId: parent.submitId,
        priceOptionId: parent.priceOptionId,
        travellerCount: parent.travellerCount,
        metadata: {
          reason: reasonText,
          initiatedBy: session.user.id,
          parentPaymentId: parent.id,
          parentRazorpayOrderId: parent.razorpayOrderId,
          parentRazorpayPaymentId: parent.razorpayPaymentId,
        },
      })
      .returning({ id: payments.id });

    if (!created) {
      return {
        success: false,
        message: 'Could not create refund payment row',
        error: 'Insert failed',
      };
    }

    const gateway = await callRazorpayRefund({
      razorpayPaymentId: parent.razorpayPaymentId,
      amountPaise,
      refundPaymentId: created.id,
      notes: {
        application_id: applicationId,
        reason: reasonText.slice(0, 200),
      },
    });

    if (!gateway.ok) {
      await markLocalRefundFailed({
        refundPaymentId: created.id,
        error: gateway.error,
      });
      revalidatePath(`/admin/applications/${applicationType}/${applicationId}`);
      revalidatePath(`/applications/${applicationType}/${applicationId}`);
      return {
        success: false,
        message: `Refund failed: ${gateway.error}`,
        error: gateway.error,
      };
    }

    await attachRazorpayRefundId({
      refundPaymentId: created.id,
      razorpayRefundId: gateway.razorpayRefundId,
      raw: gateway.raw,
    });

    revalidatePath('/admin/applications');
    revalidatePath(`/admin/applications/${applicationType}/${applicationId}`);
    revalidatePath(`/applications/${applicationType}/${applicationId}`);
    revalidatePath('/dashboard');

    return {
      success: true,
      message: 'Refund initiated',
    };
  } catch (error) {
    console.error('Error initiating application refund:', error);
    return {
      success: false,
      message: 'Failed to initiate refund',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/** @deprecated Name retained for PaymentHistory — prefer initiateApplicationRefund. */
export async function initiateVisaRefund(
  request: InitiateVisaRefundRequest
): Promise<ActionResponse> {
  return initiateApplicationRefund({ ...request, applicationType: 'visa' });
}

export async function initiatePassportRefund(
  request: InitiateVisaRefundRequest
): Promise<ActionResponse> {
  return initiateApplicationRefund({ ...request, applicationType: 'passport' });
}

/**
 * Attach (or replace) a visa outcome document on an already-approved traveller.
 */
export async function attachVisaOutcomeDocument(
  request: AttachVisaOutcomeRequest
): Promise<ActionResponse> {
  try {
    const session = await requireRole(['admin', 'reviewer']);
    const {
      applicationId,
      travellerId,
      deliveryDocumentKey,
      deliveryFilename,
      deliveryMimeType,
      deliveryFileSize,
      sendDeliveryToChannels,
    } = request;

    if (!applicationId || !travellerId || !deliveryDocumentKey) {
      return {
        success: false,
        message: 'Missing required fields',
        error: 'applicationId, travellerId, and deliveryDocumentKey are required',
      };
    }

    if (sendDeliveryToChannels && !isPdfMime(deliveryMimeType)) {
      await cleanupVisaOutcomeUpload(deliveryDocumentKey);
      return {
        success: false,
        message: 'Only PDF files can be sent on WhatsApp and email',
        error: 'PDF required when sendDeliveryToChannels is set',
      };
    }

    const denied = await denyReviewerUnlessAssigned(
      session,
      applicationId,
      'visa'
    );
    if (denied) {
      await cleanupVisaOutcomeUpload(deliveryDocumentKey);
      return denied;
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
      await cleanupVisaOutcomeUpload(deliveryDocumentKey);
      return {
        success: false,
        message: 'Traveller not found',
        error: 'Visa traveller does not exist on this application',
      };
    }

    if (traveller.status !== 'approved') {
      await cleanupVisaOutcomeUpload(deliveryDocumentKey);
      return {
        success: false,
        message: 'Traveller must be approved before attaching a visa document',
        error: `Current status is ${traveller.status}`,
      };
    }

    const [appOwner] = await db
      .select({
        userId: visaApplications.userId,
        referenceNumber: visaApplications.referenceNumber,
      })
      .from(visaApplications)
      .where(eq(visaApplications.id, applicationId))
      .limit(1);

    if (!appOwner) {
      await cleanupVisaOutcomeUpload(deliveryDocumentKey);
      return {
        success: false,
        message: 'Application not found',
        error: 'Visa application missing',
      };
    }

    let deliveryPayload: {
      documentId: string;
      s3Key: string;
      filename: string;
      mimeType: string;
      sendToChannels: boolean;
    };

    try {
      const safeKey = assertVisaOutcomeKeyForPassenger(deliveryDocumentKey, {
        applicationId,
        passengerId: traveller.passengerId,
        userId: appOwner.userId,
      });
      const row = await upsertVisaOutcomeDocumentRow({
        applicationId,
        passengerId: traveller.passengerId,
        key: safeKey,
        filename: deliveryFilename || 'visa-document.pdf',
        size: deliveryFileSize || 0,
        mimeType: deliveryMimeType || 'application/pdf',
      });
      deliveryPayload = {
        documentId: row.id,
        s3Key: row.s3Key,
        filename: row.filename,
        mimeType: row.mimeType,
        sendToChannels: Boolean(sendDeliveryToChannels),
      };
    } catch (deliveryError) {
      await cleanupVisaOutcomeUpload(deliveryDocumentKey);
      return {
        success: false,
        message:
          deliveryError instanceof Error
            ? deliveryError.message
            : 'Invalid delivery document',
        error: 'deliveryDocumentKey validation failed',
      };
    }

    revalidatePath('/admin/applications');
    revalidatePath(`/admin/applications/visa/${applicationId}`);
    revalidatePath(`/admin/applications/visa/${appOwner.referenceNumber}`);
    revalidatePath(`/applications/visa/${applicationId}`);
    revalidatePath(`/applications/visa/${appOwner.referenceNumber}`);
    revalidatePath('/applications');
    revalidatePath('/dashboard');

    if (deliveryPayload.sendToChannels) {
      try {
        await notifyVisaOutcomeDeliveredEvent({
          applicationId,
          travellerId,
          delivery: deliveryPayload,
        });
      } catch (notifyError) {
        console.error('Visa outcome delivery notification failed', notifyError);
      }
    }

    return {
      success: true,
      message: deliveryPayload.sendToChannels
        ? 'Visa document attached and sent'
        : 'Visa document attached',
    };
  } catch (error) {
    console.error('Error attaching visa outcome document:', error);
    return {
      success: false,
      message: 'Failed to attach visa document',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Verify a document
 */
export async function verifyDocument(
  request: DocumentVerificationRequest
): Promise<ActionResponse> {
  try {
    const session = await requireRole(['admin', 'reviewer']);

    const { documentId, verified, notes } = request;

    if (!documentId) {
      return {
        success: false,
        message: 'Document ID is required',
        error: 'documentId is required',
      };
    }

    if (
      session.user.role === 'reviewer' &&
      !(await reviewerOwnsDocument(session.user.id, documentId))
    ) {
      return { success: false, message: 'Document not found' };
    }

    // Update document
    await db
      .update(documents)
      .set({
        verified,
        verificationNotes: notes || null,
      })
      .where(eq(documents.id, documentId));

    // Get document info for revalidation
    const doc = await db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1);

    if (doc && doc.length > 0) {
      revalidatePath(
        `/admin/applications/${doc[0].applicationType}/${doc[0].applicationId}`
      );
    }

    return {
      success: true,
      message: verified ? 'Document verified' : 'Document rejected',
    };
  } catch (error) {
    console.error('Error verifying document:', error);
    return {
      success: false,
      message: 'Failed to verify document',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Add internal note to application (append-only application_notes)
 */
export async function addApplicationNote(
  request: AddNoteRequest
): Promise<ActionResponse> {
  try {
    const session = await requireRole(['admin', 'reviewer']);

    const { applicationId, applicationType, note } = request;

    if (!applicationId || !applicationType || !note || note.trim() === '') {
      return {
        success: false,
        message: 'Missing required fields',
        error: 'applicationId, applicationType, and note are required',
      };
    }

    if (note.length > 5000) {
      return {
        success: false,
        message: 'Note is too long',
        error: 'Note must be 5000 characters or less',
      };
    }

    const denied = await denyReviewerUnlessAssigned(
      session,
      applicationId,
      applicationType
    );
    if (denied) return denied;

    // Ensure application exists
    if (applicationType === 'visa') {
      const result = await db
        .select({ id: visaApplications.id })
        .from(visaApplications)
        .where(eq(visaApplications.id, applicationId))
        .limit(1);

      if (!result.length) {
        return { success: false, message: 'Application not found' };
      }
    } else {
      const result = await db
        .select({ id: passportServices.id })
        .from(passportServices)
        .where(eq(passportServices.id, applicationId))
        .limit(1);

      if (!result.length) {
        return { success: false, message: 'Application not found' };
      }
    }

    await db.insert(applicationNotes).values({
      applicationId,
      body: note.trim(),
      adminUserId: session.user.id,
      adminName: session.user.name || 'Admin',
      createdAt: new Date(),
    });

    revalidatePath(`/admin/applications/${applicationType}/${applicationId}`);

    return {
      success: true,
      message: 'Note added successfully',
    };
  } catch (error) {
    console.error('Error adding note:', error);
    return {
      success: false,
      message: 'Failed to add note',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Append a call log entry (admin/reviewer)
 */
export async function addApplicationCallLog(
  request: AddCallLogRequest
): Promise<ActionResponse> {
  try {
    const session = await requireRole(['admin', 'reviewer']);
    const { applicationId, phone, note, applicationType = 'visa' } = request;

    if (!applicationId || !phone?.trim() || !note?.trim()) {
      return {
        success: false,
        message: 'Missing required fields',
        error: 'applicationId, phone, and note are required',
      };
    }

    const type = applicationType === 'passport' ? 'passport' : 'visa';
    const denied = await denyReviewerUnlessAssigned(
      session,
      applicationId,
      type
    );
    if (denied) return denied;

    if (type === 'visa') {
      const [app] = await db
        .select({ id: visaApplications.id })
        .from(visaApplications)
        .where(eq(visaApplications.id, applicationId))
        .limit(1);
      if (!app) {
        return { success: false, message: 'Application not found' };
      }
    } else {
      const [app] = await db
        .select({ id: passportServices.id })
        .from(passportServices)
        .where(eq(passportServices.id, applicationId))
        .limit(1);
      if (!app) {
        return { success: false, message: 'Application not found' };
      }
    }

    await db.insert(applicationCallLogs).values({
      applicationId,
      phone: phone.trim().slice(0, 30),
      note: note.trim(),
      adminUserId: session.user.id,
      adminName: session.user.name || 'Admin',
      createdAt: new Date(),
    });

    revalidatePath(`/admin/applications/${type}/${applicationId}`);

    return { success: true, message: 'Call log added' };
  } catch (error) {
    console.error('Error adding call log:', error);
    return {
      success: false,
      message: 'Failed to add call log',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Resolve a document preview/download URL for admin.
 */
export async function getDocumentPreviewUrl(
  documentId: string
): Promise<ActionResponse<{ url: string }>> {
  try {
    const session = await requireRole(['admin', 'reviewer']);

    const [doc] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1);

    if (!doc) {
      return {
        success: false,
        message: 'Document not found',
      };
    }

    if (
      session.user.role === 'reviewer' &&
      !(await reviewerOwnsDocument(session.user.id, documentId))
    ) {
      return { success: false, message: 'Document not found' };
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

/**
 * Update user role (admin only)
 */
export async function updateUserRole(
  request: UpdateUserRoleRequest
): Promise<ActionResponse> {
  try {
    // Authorization check - admin only
    const session = await requireRole(['admin']);

    // Double-check admin role
    if (!isAdmin(session.user)) {
      return {
        success: false,
        message: 'Unauthorized',
        error: 'Only admins can change user roles',
      };
    }

    const { userId, newRole } = request;

    if (!userId || !newRole) {
      return {
        success: false,
        message: 'Missing required fields',
        error: 'userId and newRole are required',
      };
    }

    // Validate role
    if (!['user', 'admin', 'reviewer'].includes(newRole)) {
      return {
        success: false,
        message: 'Invalid role',
        error: 'Role must be user, admin, or reviewer',
      };
    }

    // Check if user exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!existingUser || existingUser.length === 0) {
      return {
        success: false,
        message: 'User not found',
        error: 'User does not exist',
      };
    }

    // Update user role
    await db
      .update(users)
      .set({
        role: newRole,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    // Revalidate pages
    revalidatePath('/admin/users');

    return {
      success: true,
      message: `User role updated to ${newRole}`,
    };
  } catch (error) {
    console.error('Error updating user role:', error);
    return {
      success: false,
      message: 'Failed to update user role',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Deactivate or restore a user or reviewer. Admin accounts cannot be deactivated.
 */
export async function setUserDeactivated(
  request: SetUserDeactivatedRequest
): Promise<ActionResponse> {
  const session = await requireRole(['admin']);

  if (!isAdmin(session.user)) {
    return {
      success: false,
      message: 'Unauthorized',
      error: 'Only admins can deactivate accounts',
    };
  }

  const userId = request.userId?.trim();
  if (!userId || typeof request.deactivated !== 'boolean') {
    return {
      success: false,
      message: 'Missing required fields',
      error: 'userId and deactivated are required',
    };
  }

  try {
    const [existingUser] = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!existingUser) {
      return {
        success: false,
        message: 'User not found',
        error: 'User does not exist',
      };
    }

    if (existingUser.role === 'admin') {
      return {
        success: false,
        message: 'Admin accounts cannot be deactivated',
        error: 'Admin accounts cannot be deactivated',
      };
    }

    await db
      .update(users)
      .set({
        deactivatedAt: request.deactivated ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    revalidatePath('/admin/users');
    revalidatePath(`/admin/users/${userId}`);

    return {
      success: true,
      message: request.deactivated
        ? 'Account deactivated'
        : 'Account reactivated',
    };
  } catch (error) {
    console.error('Error updating account access:', error);
    return {
      success: false,
      message: 'Failed to update account access',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Create a reviewer account (admin only).
 * Role is always reviewer — never taken from the client payload.
 */
export async function createReviewer(input: unknown): Promise<ActionResponse> {
  const session = await requireRole(['admin']);

  if (!isAdmin(session.user)) {
    return {
      success: false,
      message: 'Unauthorized',
      error: 'Only admins can create reviewers',
    };
  }

  const parsed = createReviewerSchema.safeParse(input);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Invalid input';
    return {
      success: false,
      message,
      error: message,
    };
  }

  const { name, email, phone, password } = parsed.data;

  try {
    const [emailOwner] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (emailOwner) {
      return {
        success: false,
        message: 'Email already registered',
        error: 'Email already registered',
      };
    }

    const [phoneOwner] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.phone, phone))
      .limit(1);

    if (phoneOwner) {
      return {
        success: false,
        message: 'Phone number already registered',
        error: 'Phone number already registered',
      };
    }

    const passwordHash = await hash(password, 12);

    const [created] = await db
      .insert(users)
      .values({
        name,
        email,
        phone,
        passwordHash,
        role: 'reviewer',
        emailVerified: new Date(),
      })
      .returning({ id: users.id, name: users.name, phone: users.phone });

    revalidatePath('/admin/users');

    await notifyReviewerWelcome({ name, email });
    if (created) {
      await notifyReviewerWelcomeWhatsApp({
        userId: created.id,
        name: created.name,
        phone: created.phone ?? phone,
      });
    }

    return {
      success: true,
      message: 'Reviewer created',
    };
  } catch (error) {
    console.error('Error creating reviewer:', error);
    return {
      success: false,
      message: 'Failed to create reviewer',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

const OPEN_VISA_COUNT = sql<number>`count(distinct ${visaApplications.id}) filter (where ${visaApplications.status} not in ('approved', 'rejected', 'partially_approved', 'draft'))`;
const OPEN_PASSPORT_COUNT = sql<number>`count(distinct ${passportServices.id}) filter (where ${passportServices.status} not in ('approved', 'rejected', 'draft'))`;

/**
 * Search reviewers and admins for assignment.
 * Admins are listed first, then reviewers with the lowest open workload.
 */
export async function searchReviewers(
  query?: string
): Promise<ActionResponse<ReviewerOption[]>> {
  const session = await requireRole(['admin']);

  if (!isAdmin(session.user)) {
    return {
      success: false,
      message: 'Unauthorized',
      error: 'Only admins can assign reviewers',
    };
  }

  const trimmed = query?.trim() ?? '';
  const filters = [inArray(users.role, ['reviewer', 'admin'])];

  if (trimmed) {
    const pattern = `%${trimmed.replace(/[%_]/g, '')}%`;
    filters.push(or(ilike(users.name, pattern), ilike(users.email, pattern))!);
  }

  try {
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        openCount: sql<number>`(${OPEN_VISA_COUNT} + ${OPEN_PASSPORT_COUNT})`,
      })
      .from(users)
      .leftJoin(
        visaApplications,
        eq(visaApplications.assignedReviewerId, users.id)
      )
      .leftJoin(
        passportServices,
        eq(passportServices.assignedReviewerId, users.id)
      )
      .where(and(...filters))
      .groupBy(users.id, users.name, users.email, users.role)
      .orderBy(
        sql`case when ${users.role} = 'admin' then 0 else 1 end`,
        sql`(${OPEN_VISA_COUNT} + ${OPEN_PASSPORT_COUNT})`,
        asc(users.name)
      )
      .limit(20);

    return {
      success: true,
      message: 'Reviewers loaded',
      data: rows.map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role === 'admin' ? 'admin' : 'reviewer',
        openCount: Number(row.openCount) || 0,
      })),
    };
  } catch (error) {
    console.error('Error searching reviewers:', error);
    return {
      success: false,
      message: 'Failed to search reviewers',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Assign or reassign a reviewer on a visa application (admin only).
 */
export async function assignVisaReviewer(
  applicationId: string,
  reviewerId: string
): Promise<ActionResponse> {
  const session = await requireRole(['admin']);

  if (!isAdmin(session.user)) {
    return {
      success: false,
      message: 'Unauthorized',
      error: 'Only admins can assign reviewers',
    };
  }

  if (!applicationId || !reviewerId) {
    return {
      success: false,
      message: 'Missing required fields',
      error: 'applicationId and reviewerId are required',
    };
  }

  try {
    const [application] = await db
      .select({
        id: visaApplications.id,
        referenceNumber: visaApplications.referenceNumber,
        country: visaApplications.country,
        countryCode: visaApplications.countryCode,
        visaType: visaApplications.visaType,
        applicantName: visaApplications.applicantName,
      })
      .from(visaApplications)
      .where(eq(visaApplications.id, applicationId))
      .limit(1);

    if (!application) {
      return {
        success: false,
        message: 'Application not found',
        error: 'Visa application does not exist',
      };
    }

    const [reviewer] = await db
      .select({
        id: users.id,
        role: users.role,
        name: users.name,
        email: users.email,
      })
      .from(users)
      .where(eq(users.id, reviewerId))
      .limit(1);

    if (!reviewer || (reviewer.role !== 'reviewer' && reviewer.role !== 'admin')) {
      return {
        success: false,
        message: 'Assignee not found',
        error: 'Selected user is not a reviewer or admin',
      };
    }

    await db
      .update(visaApplications)
      .set({
        assignedReviewerId: reviewerId,
        updatedAt: new Date(),
      })
      .where(eq(visaApplications.id, applicationId));

    revalidatePath('/admin/applications');
    revalidatePath(`/admin/applications/visa/${application.referenceNumber}`);
    revalidatePath(`/admin/applications/visa/${applicationId}`);

    await notifyReviewerAssigned({
      email: reviewer.email,
      reviewerName: reviewer.name,
      applicantName: application.applicantName || 'Applicant',
      country: application.country || application.countryCode || 'Unknown',
      visaType: application.visaType,
      referenceNumber: application.referenceNumber,
    });
    await notifyReviewerAssignedWhatsApp({
      reviewerUserId: reviewer.id,
      reviewerName: reviewer.name,
      applicantName: application.applicantName || 'Applicant',
      country: application.country || application.countryCode || 'Unknown',
      visaType: application.visaType,
      referenceNumber: application.referenceNumber,
    });

    return {
      success: true,
      message: 'Reviewer assigned',
    };
  } catch (error) {
    console.error('Error assigning reviewer:', error);
    return {
      success: false,
      message: 'Failed to assign reviewer',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Assign or reassign a reviewer on a passport application (admin only).
 */
export async function assignPassportReviewer(
  applicationId: string,
  reviewerId: string
): Promise<ActionResponse> {
  const session = await requireRole(['admin']);

  if (!isAdmin(session.user)) {
    return {
      success: false,
      message: 'Unauthorized',
      error: 'Only admins can assign reviewers',
    };
  }

  if (!applicationId || !reviewerId) {
    return {
      success: false,
      message: 'Missing required fields',
      error: 'applicationId and reviewerId are required',
    };
  }

  try {
    const [application] = await db
      .select({
        id: passportServices.id,
        referenceNumber: passportServices.referenceNumber,
        serviceType: passportServices.serviceType,
        formSnapshot: passportServices.formSnapshot,
        answers: passportServices.answers,
        applicantName: users.name,
      })
      .from(passportServices)
      .innerJoin(users, eq(passportServices.userId, users.id))
      .where(eq(passportServices.id, applicationId))
      .limit(1);

    if (!application) {
      return {
        success: false,
        message: 'Application not found',
        error: 'Passport application does not exist',
      };
    }

    const [reviewer] = await db
      .select({
        id: users.id,
        role: users.role,
        name: users.name,
        email: users.email,
      })
      .from(users)
      .where(eq(users.id, reviewerId))
      .limit(1);

    if (!reviewer || (reviewer.role !== 'reviewer' && reviewer.role !== 'admin')) {
      return {
        success: false,
        message: 'Assignee not found',
        error: 'Selected user is not a reviewer or admin',
      };
    }

    const snapshot =
      (application.formSnapshot as PassportApplyFormConfig | null) ?? null;
    const productName =
      snapshot?.productName ||
      (application.serviceType === 'reissue'
        ? 'Passport reissue'
        : 'New passport');
    const referenceNumber =
      application.referenceNumber || application.id.slice(0, 8);

    await db
      .update(passportServices)
      .set({
        assignedReviewerId: reviewerId,
        updatedAt: new Date(),
      })
      .where(eq(passportServices.id, applicationId));

    revalidatePath('/admin/applications');
    revalidatePath(`/admin/applications/passport/${referenceNumber}`);
    revalidatePath(`/admin/applications/passport/${applicationId}`);

    const answers = (application.answers ?? {}) as Record<string, unknown>;
    const given =
      typeof answers.givenNames === 'string' ? answers.givenNames.trim() : '';
    const surname =
      typeof answers.surname === 'string' ? answers.surname.trim() : '';
    const applicantName =
      `${given} ${surname}`.trim() ||
      application.applicantName?.trim() ||
      'Applicant';
    const serviceType = passportServiceTypeLabel(application.serviceType);

    await notifyPassportReviewerAssigned({
      email: reviewer.email,
      reviewerName: reviewer.name,
      applicantName,
      serviceType,
      productName,
      referenceNumber,
    });
    await notifyPassportReviewerAssignedWhatsApp({
      reviewerUserId: reviewer.id,
      reviewerName: reviewer.name,
      applicantName,
      serviceType,
      productName,
      referenceNumber,
    });

    return {
      success: true,
      message: 'Reviewer assigned',
    };
  } catch (error) {
    console.error('Error assigning passport reviewer:', error);
    return {
      success: false,
      message: 'Failed to assign reviewer',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function revalidateVisaSurfaces(applicationId: string) {
  const [row] = await db
    .select({ referenceNumber: visaApplications.referenceNumber })
    .from(visaApplications)
    .where(eq(visaApplications.id, applicationId))
    .limit(1);
  const referenceNumber = row?.referenceNumber;

  revalidatePath('/admin');
  revalidatePath('/admin/applications');
  revalidatePath(`/admin/applications/visa/${applicationId}`);
  revalidatePath(`/applications/visa/${applicationId}`);
  revalidatePath(`/applications/visa/${applicationId}/fix`);
  if (referenceNumber) {
    revalidatePath(`/admin/applications/visa/${referenceNumber}`);
    revalidatePath(`/applications/visa/${referenceNumber}`);
    revalidatePath(`/applications/visa/${referenceNumber}/fix`);
  }
  revalidatePath('/applications');
  revalidatePath('/dashboard');
}

async function revalidatePassportSurfaces(applicationId: string) {
  const [row] = await db
    .select({ referenceNumber: passportServices.referenceNumber })
    .from(passportServices)
    .where(eq(passportServices.id, applicationId))
    .limit(1);
  const referenceNumber = row?.referenceNumber;

  revalidatePath('/admin');
  revalidatePath('/admin/applications');
  revalidatePath(`/admin/applications/passport/${applicationId}`);
  revalidatePath(`/applications/passport/${applicationId}`);
  revalidatePath(`/applications/passport/${applicationId}/fix`);
  if (referenceNumber) {
    revalidatePath(`/admin/applications/passport/${referenceNumber}`);
    revalidatePath(`/applications/passport/${referenceNumber}`);
    revalidatePath(`/applications/passport/${referenceNumber}/fix`);
  }
  revalidatePath('/applications');
  revalidatePath('/dashboard');
}

function staffRole(role: string | undefined): 'admin' | 'reviewer' {
  return role === 'reviewer' ? 'reviewer' : 'admin';
}

/**
 * Ask the applicant to reupload documents or refill specific fields.
 */
export async function requestCorrection(
  input: unknown
): Promise<ActionResponse> {
  try {
    const session = await requireRole(['admin', 'reviewer']);
    const parsed = requestCorrectionSchema.safeParse(input);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Invalid request';
      return { success: false, message, error: message };
    }

    const { applicationId, travellerId, message, items } = parsed.data;
    if (
      await reviewerAccessDenied(
        session.user.id,
        session.user.role,
        applicationId
      )
    ) {
      return { success: false, message: 'Application not found' };
    }

    const [application] = await db
      .select()
      .from(visaApplications)
      .where(eq(visaApplications.id, applicationId))
      .limit(1);
    if (!application || application.status === 'draft') {
      return {
        success: false,
        message: 'Application not found',
      };
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
    if (traveller.status === 'approved' || traveller.status === 'rejected') {
      return {
        success: false,
        message: 'This traveller is already finished',
      };
    }

    const config = (application.formSnapshot as ApplyFormConfig | null) ?? null;
    const invalid = validateRequestedItems(config, items);
    if (invalid) return { success: false, message: invalid };

    const open = await getOpenCorrection(applicationId, travellerId);
    if (open) {
      return {
        success: false,
        message: 'This traveller already has an open correction request',
      };
    }

    const storedTravellers = Array.isArray(application.travellers)
      ? (application.travellers as StoredTraveller[])
      : [];
    const stored = storedTravellers.find(
      (item) => item.passengerId === traveller.passengerId
    );
    const now = new Date();
    const role = staffRole(session.user.role);

    await db.transaction(async (tx) => {
      await tx
        .update(correctionRequests)
        .set({ status: 'resolved', resolvedAt: now })
        .where(
          and(
            eq(correctionRequests.applicationId, applicationId),
            eq(correctionRequests.travellerId, travellerId),
            eq(correctionRequests.status, 'resubmitted')
          )
        );

      const [request] = await tx
        .insert(correctionRequests)
        .values({
          applicationId,
          applicationType: 'visa',
          travellerId,
          requestedBy: session.user.id,
          message,
          status: 'open',
          createdAt: now,
        })
        .returning();

      await tx.insert(correctionItems).values(
        items.map((item) => ({
          requestId: request.id,
          kind: item.kind,
          targetKey: item.targetKey,
          comment: item.comment,
          status: 'open' as const,
          previousValue: stored
            ? readTargetValue(stored, item.targetKey)
            : null,
        }))
      );

      await tx
        .update(visaApplicationTravellers)
        .set({
          status: 'action_required',
          updatedAt: now,
          completedAt: null,
        })
        .where(eq(visaApplicationTravellers.id, travellerId));

      await tx.insert(statusHistory).values({
        applicationId,
        applicationType: 'visa',
        travellerId,
        oldStatus: traveller.status,
        newStatus: 'action_required',
        changedBy: session.user.id,
        notes: message,
        createdAt: now,
      });

      await tx.insert(applicationComments).values({
        applicationId,
        travellerId,
        authorId: session.user.id,
        authorRole: role,
        body: message,
        createdAt: now,
      });
    });

    await recomputeVisaCaseStatus(applicationId);
    await revalidateVisaSurfaces(applicationId);
    try {
      await notifyCorrectionRequestedEvent({ applicationId, message });
    } catch (notifyError) {
      console.error('Correction notification failed', notifyError);
    }

    return { success: true, message: 'Correction requested' };
  } catch (error) {
    console.error('Error requesting correction:', error);
    return {
      success: false,
      message: 'Failed to request correction',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Ask the applicant to fix passport form fields or documents.
 */
export async function requestPassportCorrection(
  input: unknown
): Promise<ActionResponse> {
  try {
    const session = await requireRole(['admin', 'reviewer']);
    const parsed = requestPassportCorrectionSchema.safeParse(input);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Invalid request';
      return { success: false, message, error: message };
    }

    const { applicationId, message, items } = parsed.data;
    if (
      await reviewerAccessDenied(
        session.user.id,
        session.user.role,
        applicationId,
        'passport'
      )
    ) {
      return { success: false, message: 'Application not found' };
    }

    const [application] = await db
      .select()
      .from(passportServices)
      .where(eq(passportServices.id, applicationId))
      .limit(1);
    if (!application || application.status === 'draft') {
      return { success: false, message: 'Application not found' };
    }
    if (
      application.status === 'approved' ||
      application.status === 'rejected'
    ) {
      return { success: false, message: 'This application is already finished' };
    }

    const config =
      (application.formSnapshot as PassportApplyFormConfig | null) ?? null;
    const invalid = validatePassportRequestedItems(config, items);
    if (invalid) return { success: false, message: invalid };

    const open = await getOpenPassportCorrection(applicationId);
    if (open) {
      return {
        success: false,
        message: 'This application already has an open correction request',
      };
    }

    const answers =
      application.answers && typeof application.answers === 'object'
        ? (application.answers as Record<string, unknown>)
        : {};
    const storedDocs = Array.isArray(application.documents)
      ? (application.documents as StoredPassportDocument[])
      : [];
    const now = new Date();
    const role = staffRole(session.user.role);
    const oldStatus = application.status;

    await db.transaction(async (tx) => {
      await tx
        .update(correctionRequests)
        .set({ status: 'resolved', resolvedAt: now })
        .where(
          and(
            eq(correctionRequests.applicationId, applicationId),
            eq(correctionRequests.applicationType, 'passport'),
            isNull(correctionRequests.travellerId),
            eq(correctionRequests.status, 'resubmitted')
          )
        );

      const [request] = await tx
        .insert(correctionRequests)
        .values({
          applicationId,
          applicationType: 'passport',
          travellerId: null,
          requestedBy: session.user.id,
          message,
          status: 'open',
          createdAt: now,
        })
        .returning();

      await tx.insert(correctionItems).values(
        items.map((item) => ({
          requestId: request.id,
          kind: item.kind,
          targetKey: item.targetKey,
          comment: item.comment,
          status: 'open' as const,
          previousValue: readPassportTargetValue(
            answers,
            storedDocs,
            item.targetKey,
            item.kind
          ),
        }))
      );

      await tx
        .update(passportServices)
        .set({
          status: 'action_required',
          updatedAt: now,
          completedAt: null,
        })
        .where(eq(passportServices.id, applicationId));

      await tx.insert(statusHistory).values({
        applicationId,
        applicationType: 'passport',
        travellerId: null,
        oldStatus,
        newStatus: 'action_required',
        changedBy: session.user.id,
        notes: message,
        createdAt: now,
      });

      await tx.insert(applicationComments).values({
        applicationId,
        travellerId: null,
        authorId: session.user.id,
        authorRole: role,
        body: message,
        createdAt: now,
      });
    });

    await revalidatePassportSurfaces(applicationId);
    try {
      await notifyPassportCorrectionRequestedEvent({ applicationId, message });
    } catch (notifyError) {
      console.error('Passport correction notification failed', notifyError);
    }

    return { success: true, message: 'Correction requested' };
  } catch (error) {
    console.error('Error requesting passport correction:', error);
    return {
      success: false,
      message: 'Failed to request correction',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

const ALLOWED_STAFF_EDIT_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

/**
 * Staff correct one traveller field or document in place.
 * Writes the new value and an audit row. Does not ask the applicant to resubmit.
 */
export async function applyStaffFieldEdit(
  input: unknown
): Promise<ActionResponse> {
  try {
    const session = await requireRole(['admin', 'reviewer']);
    const parsed = staffFieldEditSchema.safeParse(input);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Invalid update';
      return { success: false, message, error: message };
    }

    const { applicationId, travellerId, targetKey, message, value, file } =
      parsed.data;
    if (
      await reviewerAccessDenied(
        session.user.id,
        session.user.role,
        applicationId
      )
    ) {
      return { success: false, message: 'Application not found' };
    }

    const [application] = await db
      .select()
      .from(visaApplications)
      .where(eq(visaApplications.id, applicationId))
      .limit(1);
    if (!application || application.status === 'draft') {
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
    if (traveller.status === 'approved' || traveller.status === 'rejected') {
      return {
        success: false,
        message: 'This traveller is already finished',
      };
    }

    const config = (application.formSnapshot as ApplyFormConfig | null) ?? null;
    const target = buildCorrectableTargets(config).find(
      (item) => item.targetKey === targetKey
    );
    if (!target) {
      return { success: false, message: 'Unknown field' };
    }
    if (target.kind === 'field' && (file || value === undefined)) {
      return { success: false, message: 'Send a new value for this field' };
    }
    if (target.kind === 'document' && (!file || value !== undefined)) {
      return { success: false, message: 'Upload a replacement file' };
    }

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
    let previousValue: unknown;
    let newValue: unknown;
    let uploaded: {
      key: string;
      url: string;
      slotKey: string;
      passengerId: string;
      filename: string;
      mimeType: string;
      size: number;
      previousKey?: string | null;
    } | null = null;

    if (target.kind === 'field') {
      const issue = validateFieldValue(config, targetKey, value ?? '');
      if (issue) return { success: false, message: issue };
      previousValue = readTargetValue(nextTraveller, targetKey);
      const nextText = (value ?? '').trim();
      if (String(previousValue ?? '').trim() === nextText) {
        return { success: false, message: 'Enter a different value' };
      }
      nextTraveller = writeFieldValue(nextTraveller, targetKey, nextText);
      newValue = nextText;
    } else {
      const replacement = file!;
      if (!ALLOWED_STAFF_EDIT_MIME.has(replacement.mimeType)) {
        return { success: false, message: 'Upload a JPG, PNG, WEBP, or PDF' };
      }
      const bytes = Buffer.from(replacement.bufferBase64, 'base64');
      const max =
        replacement.mimeType === 'application/pdf'
          ? 10 * 1024 * 1024
          : 5 * 1024 * 1024;
      if (bytes.length === 0 || bytes.length > max) {
        return { success: false, message: 'File is empty or too large' };
      }
      if (!application.countryCode || !application.visaListingId) {
        return {
          success: false,
          message: 'This application cannot accept new files',
        };
      }

      const currentDoc = (nextTraveller.documents ?? []).find(
        (item) => item.slotKey === targetKey
      );
      const previousStorageKey = currentDoc?.key ?? null;
      previousValue = currentDoc
        ? {
            filename: currentDoc.filename ?? null,
            key: currentDoc.key ?? null,
            url: currentDoc.url ?? null,
            mimeType: currentDoc.mimeType ?? null,
          }
        : readTargetValue(nextTraveller, targetKey);

      const uploadResult = await uploadApplicationDocuments({
        countryCode: application.countryCode,
        listingId: application.visaListingId,
        applicationId,
        documents: [
          {
            passengerId: traveller.passengerId,
            slotKey: targetKey,
            filename: replacement.filename,
            mimeType: replacement.mimeType,
            bufferBase64: replacement.bufferBase64,
          },
        ],
      });
      if (!uploadResult.success) {
        return {
          success: false,
          message: uploadResult.error || 'Document upload failed',
        };
      }
      const uploadedDoc = uploadResult.results[0];
      if (!uploadedDoc) {
        return { success: false, message: 'Document upload failed' };
      }
      await deleteReplacedObjectKey(previousStorageKey, uploadedDoc.key);
      await deleteOtherSlotExtensionKeys(uploadedDoc.key);
      nextTraveller = replaceTravellerDocument(nextTraveller, targetKey, {
        slotKey: uploadedDoc.slotKey,
        key: uploadedDoc.key,
        url: uploadedDoc.url,
        mimeType: uploadedDoc.mimeType,
        filename: uploadedDoc.filename,
        size: uploadedDoc.size,
      });
      newValue = {
        filename: uploadedDoc.filename,
        key: uploadedDoc.key,
        url: uploadedDoc.url,
        mimeType: uploadedDoc.mimeType,
      };
      uploaded = { ...uploadedDoc, previousKey: previousStorageKey };
    }

    const nextTravellers = storedTravellers.map((item, index) =>
      index === travellerIndex ? nextTraveller : item
    );
    const summary = Array.isArray(application.documents)
      ? [...(application.documents as Array<Record<string, unknown>>)]
      : [];
    if (uploaded) {
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

    const now = new Date();
    await db.transaction(async (tx) => {
      await tx
        .update(visaApplications)
        .set({
          travellers: nextTravellers,
          ...(uploaded ? { documents: summary } : {}),
          ...(personal ? { personalInfo: personal } : {}),
          updatedAt: now,
        })
        .where(eq(visaApplications.id, applicationId));

      if (uploaded) {
        await upsertApplicationDocumentRow(tx, {
          applicationId,
          passengerId: uploaded.passengerId,
          slotKey: uploaded.slotKey,
          previousKey: uploaded.previousKey,
          key: uploaded.key,
          filename: uploaded.filename,
          size: uploaded.size,
          mimeType: uploaded.mimeType,
          now,
        });
      }

      await tx.insert(staffFieldEdits).values({
        applicationId,
        applicationType: 'visa',
        travellerId,
        actorId: session.user.id,
        kind: target.kind,
        targetKey,
        message,
        previousValue,
        newValue,
        createdAt: now,
      });
    });

    await revalidateVisaSurfaces(applicationId);
    return { success: true, message: 'Correction saved' };
  } catch (error) {
    console.error('Error saving staff field edit:', error);
    return {
      success: false,
      message: 'Failed to save correction',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Staff correct one passport field or document in place.
 */
export async function applyPassportStaffFieldEdit(
  input: unknown
): Promise<ActionResponse> {
  try {
    const session = await requireRole(['admin', 'reviewer']);
    const parsed = staffPassportFieldEditSchema.safeParse(input);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Invalid update';
      return { success: false, message, error: message };
    }

    const { applicationId, targetKey, message, value, file } = parsed.data;
    if (
      await reviewerAccessDenied(
        session.user.id,
        session.user.role,
        applicationId,
        'passport'
      )
    ) {
      return { success: false, message: 'Application not found' };
    }

    const [application] = await db
      .select()
      .from(passportServices)
      .where(eq(passportServices.id, applicationId))
      .limit(1);
    if (!application || application.status === 'draft') {
      return { success: false, message: 'Application not found' };
    }
    if (
      application.status === 'approved' ||
      application.status === 'rejected'
    ) {
      return { success: false, message: 'This application is already finished' };
    }

    const config =
      (application.formSnapshot as PassportApplyFormConfig | null) ?? null;
    const target = buildPassportCorrectableTargets(config).find(
      (item) => item.targetKey === targetKey
    );
    if (!target) {
      return { success: false, message: 'Unknown field' };
    }
    if (target.kind === 'field' && (file || value === undefined)) {
      return { success: false, message: 'Send a new value for this field' };
    }
    if (target.kind === 'document' && (!file || value !== undefined)) {
      return { success: false, message: 'Upload a replacement file' };
    }

    let answers =
      application.answers && typeof application.answers === 'object'
        ? { ...(application.answers as Record<string, unknown>) }
        : {};
    let documents = Array.isArray(application.documents)
      ? [...(application.documents as StoredPassportDocument[])]
      : [];

    let previousValue: unknown;
    let newValue: unknown;
    let uploaded: {
      key: string;
      url: string;
      slotKey: string;
      filename: string;
      mimeType: string;
      size: number;
      previousKey?: string | null;
    } | null = null;

    if (target.kind === 'field') {
      const issue = validatePassportFieldValue(config, targetKey, value ?? '');
      if (issue) return { success: false, message: issue };
      previousValue = readPassportAnswerValue(answers, targetKey);
      const nextText = (value ?? '').trim();
      if (String(previousValue ?? '').trim() === nextText) {
        return { success: false, message: 'Enter a different value' };
      }
      answers = writePassportAnswerValue(answers, targetKey, nextText);
      newValue = nextText;
    } else {
      const replacement = file!;
      if (!ALLOWED_STAFF_EDIT_MIME.has(replacement.mimeType)) {
        return { success: false, message: 'Upload a JPG, PNG, WEBP, or PDF' };
      }
      const bytes = Buffer.from(replacement.bufferBase64, 'base64');
      const max =
        replacement.mimeType === 'application/pdf'
          ? 10 * 1024 * 1024
          : 5 * 1024 * 1024;
      if (bytes.length === 0 || bytes.length > max) {
        return { success: false, message: 'File is empty or too large' };
      }
      if (!application.passportListingId) {
        return {
          success: false,
          message: 'This application cannot accept new files',
        };
      }

      const currentDoc = documents.find((item) => item.slotKey === targetKey);
      const previousStorageKey = currentDoc?.key ?? null;
      previousValue = currentDoc
        ? {
            filename: currentDoc.filename ?? null,
            key: currentDoc.key ?? null,
            url: currentDoc.url ?? null,
            mimeType: currentDoc.mimeType ?? null,
          }
        : null;

      const uploadResult = await uploadApplicationDocuments({
        countryCode: PASSPORT_DRAFT_COUNTRY_CODE,
        listingId: application.passportListingId,
        applicationId,
        documents: [
          {
            passengerId: PASSPORT_DRAFT_PASSENGER_ID,
            slotKey: targetKey,
            filename: replacement.filename,
            mimeType: replacement.mimeType,
            bufferBase64: replacement.bufferBase64,
          },
        ],
      });
      if (!uploadResult.success) {
        return {
          success: false,
          message: uploadResult.error || 'Document upload failed',
        };
      }
      const uploadedDoc = uploadResult.results[0];
      if (!uploadedDoc) {
        return { success: false, message: 'Document upload failed' };
      }
      await deleteReplacedObjectKey(previousStorageKey, uploadedDoc.key);
      await deleteOtherSlotExtensionKeys(uploadedDoc.key);
      documents = replacePassportDocument(documents, targetKey, {
        slotKey: uploadedDoc.slotKey,
        key: uploadedDoc.key,
        url: uploadedDoc.url,
        mimeType: uploadedDoc.mimeType,
        filename: uploadedDoc.filename,
        size: uploadedDoc.size,
      });
      newValue = {
        filename: uploadedDoc.filename,
        key: uploadedDoc.key,
        url: uploadedDoc.url,
        mimeType: uploadedDoc.mimeType,
      };
      uploaded = { ...uploadedDoc, previousKey: previousStorageKey };
    }

    const now = new Date();
    await db.transaction(async (tx) => {
      await tx
        .update(passportServices)
        .set({
          answers,
          personalInfo: answers,
          documents,
          updatedAt: now,
        })
        .where(eq(passportServices.id, applicationId));

      if (uploaded) {
        await upsertApplicationDocumentRow(tx, {
          applicationId,
          applicationType: 'passport',
          passengerId: PASSPORT_DRAFT_PASSENGER_ID,
          slotKey: uploaded.slotKey,
          previousKey: uploaded.previousKey,
          key: uploaded.key,
          filename: uploaded.filename,
          size: uploaded.size,
          mimeType: uploaded.mimeType,
          now,
        });
      }

      await tx.insert(staffFieldEdits).values({
        applicationId,
        applicationType: 'passport',
        travellerId: null,
        actorId: session.user.id,
        kind: target.kind,
        targetKey,
        message,
        previousValue,
        newValue,
        createdAt: now,
      });
    });

    await revalidatePassportSurfaces(applicationId);
    return { success: true, message: 'Correction saved' };
  } catch (error) {
    console.error('Error saving passport staff field edit:', error);
    return {
      success: false,
      message: 'Failed to save correction',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/** Accept a resubmitted correction round and keep the file under review. */
export async function resolveCorrection(
  input: unknown
): Promise<ActionResponse> {
  try {
    const session = await requireRole(['admin', 'reviewer']);
    const parsed = resolveCorrectionSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, message: 'Invalid request' };
    }

    const [request] = await db
      .select()
      .from(correctionRequests)
      .where(eq(correctionRequests.id, parsed.data.requestId))
      .limit(1);
    if (!request || request.status !== 'resubmitted') {
      return {
        success: false,
        message: 'There is no resubmitted correction to accept',
      };
    }

    const applicationType =
      request.applicationType === 'passport' ? 'passport' : 'visa';
    if (
      await reviewerAccessDenied(
        session.user.id,
        session.user.role,
        request.applicationId,
        applicationType
      )
    ) {
      return { success: false, message: 'Application not found' };
    }

    const now = new Date();
    const acceptedBody = 'Updates accepted. Review is continuing.';
    await db.transaction(async (tx) => {
      await tx
        .update(correctionRequests)
        .set({ status: 'resolved', resolvedAt: now })
        .where(eq(correctionRequests.id, request.id));
      await tx
        .update(correctionItems)
        .set({ status: 'accepted' })
        .where(eq(correctionItems.requestId, request.id));
      await tx.insert(applicationComments).values({
        applicationId: request.applicationId,
        travellerId: request.travellerId,
        authorId: session.user.id,
        authorRole: staffRole(session.user.role),
        body: acceptedBody,
        createdAt: now,
      });
      await tx.insert(statusHistory).values({
        applicationId: request.applicationId,
        applicationType,
        travellerId: request.travellerId,
        oldStatus: 'under_review',
        newStatus: 'under_review',
        changedBy: session.user.id,
        notes: 'Accepted applicant updates',
        createdAt: now,
      });

      if (applicationType === 'passport') {
        await tx
          .update(passportServices)
          .set({ status: 'under_review', updatedAt: now })
          .where(eq(passportServices.id, request.applicationId));
      } else if (request.travellerId) {
        await tx
          .update(visaApplicationTravellers)
          .set({ status: 'under_review', updatedAt: now })
          .where(eq(visaApplicationTravellers.id, request.travellerId));
      }
    });

    if (applicationType === 'passport') {
      await revalidatePassportSurfaces(request.applicationId);
    } else {
      await revalidateVisaSurfaces(request.applicationId);
      if (request.travellerId) {
        await recomputeVisaCaseStatus(request.applicationId);
      }
    }
    try {
      await notifyCommentEvent({
        applicationId: request.applicationId,
        authorId: session.user.id,
        authorName: session.user.name || 'Reviewer',
        authorRole: staffRole(session.user.role),
        body: acceptedBody,
      });
    } catch (notifyError) {
      console.error('Resolve notification failed', notifyError);
    }
    return { success: true, message: 'Updates accepted' };
  } catch (error) {
    console.error('Error resolving correction:', error);
    return {
      success: false,
      message: 'Failed to accept updates',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function postStaffComment(
  input: unknown
): Promise<ActionResponse> {
  try {
    const session = await requireRole(['admin', 'reviewer']);
    const parsed = commentBodySchema.safeParse(input);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Comment is required';
      return { success: false, message, error: message };
    }

    const { applicationId, body } = parsed.data;

    const [visaApplication] = await db
      .select({ id: visaApplications.id })
      .from(visaApplications)
      .where(eq(visaApplications.id, applicationId))
      .limit(1);
    const [passportApplication] = visaApplication
      ? []
      : await db
          .select({ id: passportServices.id })
          .from(passportServices)
          .where(eq(passportServices.id, applicationId))
          .limit(1);

    const applicationType = visaApplication
      ? 'visa'
      : passportApplication
        ? 'passport'
        : null;
    if (!applicationType) {
      return { success: false, message: 'Application not found' };
    }

    if (
      await reviewerAccessDenied(
        session.user.id,
        session.user.role,
        applicationId,
        applicationType
      )
    ) {
      return { success: false, message: 'Application not found' };
    }

    const role = staffRole(session.user.role);
    await db.insert(applicationComments).values({
      applicationId,
      authorId: session.user.id,
      authorRole: role,
      body,
      createdAt: new Date(),
    });

    if (applicationType === 'passport') {
      await revalidatePassportSurfaces(applicationId);
    } else {
      await revalidateVisaSurfaces(applicationId);
    }
    try {
      await notifyCommentEvent({
        applicationId,
        authorId: session.user.id,
        authorName: session.user.name || 'Reviewer',
        authorRole: role,
        body,
      });
    } catch (notifyError) {
      console.error('Comment notification failed', notifyError);
    }

    return { success: true, message: 'Comment posted' };
  } catch (error) {
    console.error('Error posting comment:', error);
    return {
      success: false,
      message: 'Failed to post comment',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function applicationExists(
  applicationId: string,
  applicationType: 'visa' | 'passport'
): Promise<boolean> {
  if (applicationType === 'visa') {
    const result = await db
      .select({ id: visaApplications.id })
      .from(visaApplications)
      .where(eq(visaApplications.id, applicationId))
      .limit(1);
    return result.length > 0;
  }
  const result = await db
    .select({ id: passportServices.id })
    .from(passportServices)
    .where(eq(passportServices.id, applicationId))
    .limit(1);
  return result.length > 0;
}

/**
 * Save or replace the portal username and password for one application.
 * The password is encrypted before it is stored.
 */
export async function saveApplicationCredential(
  input: unknown
): Promise<ActionResponse> {
  try {
    const session = await requireRole(['admin', 'reviewer']);
    const parsed = saveApplicationCredentialSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        message: 'Check the username and password',
        error: parsed.error.issues[0]?.message ?? 'Invalid credential',
      };
    }

    const { applicationId, applicationType, username, password } = parsed.data;
    const denied = await denyReviewerUnlessAssigned(
      session,
      applicationId,
      applicationType
    );
    if (denied) return denied;

    if (!(await applicationExists(applicationId, applicationType))) {
      return { success: false, message: 'Application not found' };
    }

    const encrypted = encryptPassword(password);
    await db
      .insert(applicationCredentials)
      .values({
        applicationId,
        applicationType,
        username,
        passwordCiphertext: encrypted.ciphertext,
        passwordIv: encrypted.iv,
        keyVersion: encrypted.keyVersion,
        createdBy: session.user.id,
        updatedBy: session.user.id,
      })
      .onConflictDoUpdate({
        target: [
          applicationCredentials.applicationId,
          applicationCredentials.applicationType,
        ],
        set: {
          username,
          passwordCiphertext: encrypted.ciphertext,
          passwordIv: encrypted.iv,
          keyVersion: encrypted.keyVersion,
          updatedBy: session.user.id,
          updatedAt: new Date(),
        },
      });

    revalidatePath(`/admin/applications/${applicationType}/${applicationId}`);
    return { success: true, message: 'Portal login saved' };
  } catch (error) {
    console.error('Error saving portal credential');
    return {
      success: false,
      message: credentialFailureMessage(error, 'Failed to save portal login'),
    };
  }
}

/**
 * Decrypt the portal password after a staff role and assignment check.
 * Returns the password once so the browser can copy it. Writes an audit row.
 */
export async function revealApplicationCredential(
  input: unknown
): Promise<ActionResponse<{ password: string }>> {
  try {
    const session = await requireRole(['admin', 'reviewer']);
    const parsed = revealApplicationCredentialSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        message: 'Invalid request',
      };
    }

    const { applicationId, applicationType } = parsed.data;
    const denied = await denyReviewerUnlessAssigned(
      session,
      applicationId,
      applicationType
    );
    if (denied) {
      return { success: false, message: denied.message };
    }

    const [row] = await db
      .select({
        id: applicationCredentials.id,
        passwordCiphertext: applicationCredentials.passwordCiphertext,
        passwordIv: applicationCredentials.passwordIv,
        keyVersion: applicationCredentials.keyVersion,
      })
      .from(applicationCredentials)
      .where(
        and(
          eq(applicationCredentials.applicationId, applicationId),
          eq(applicationCredentials.applicationType, applicationType)
        )
      )
      .limit(1);

    if (!row) {
      return { success: false, message: 'No portal login saved' };
    }

    const password = decryptPassword(
      row.passwordCiphertext,
      row.passwordIv,
      row.keyVersion
    );

    await db.insert(applicationCredentialReveals).values({
      credentialId: row.id,
      revealedBy: session.user.id,
    });

    return {
      success: true,
      message: 'Password ready',
      data: { password },
    };
  } catch (error) {
    console.error('Error revealing portal credential');
    return {
      success: false,
      message: credentialFailureMessage(error, 'Failed to copy password'),
    };
  }
}

function credentialFailureMessage(error: unknown, fallback: string): string {
  if (
    error instanceof Error &&
    error.message.startsWith('CREDENTIALS_ENCRYPTION_KEY')
  ) {
    return 'Portal encryption is not configured';
  }
  return fallback;
}
