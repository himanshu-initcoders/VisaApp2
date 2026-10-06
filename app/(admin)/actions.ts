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
  correctionItems,
  correctionRequests,
} from '@/lib/db/schema';
import { and, asc, eq, ilike, or, sql } from 'drizzle-orm';
import { signOut } from '@/lib/auth';
import { requireRole, isValidStatusTransition, isAdmin } from '@/lib/auth-utils';
import {
  notifyReviewerAssigned,
  notifyReviewerWelcome,
} from '@/lib/email/notify';
import { createReviewerSchema } from '@/lib/validations/auth';
import { recomputeVisaCaseStatus } from '@/lib/visa/travellerStatus';
import {
  commentBodySchema,
  getOpenCorrection,
  readTargetValue,
  requestCorrectionSchema,
  resolveCorrectionSchema,
  reviewerAccessDenied,
  validateRequestedItems,
  type StoredTraveller,
} from '@/lib/visa/corrections';
import type { ApplyFormConfig } from '@/lib/apply/applicationForm';
import {
  notifyCommentEvent,
  notifyCorrectionRequestedEvent,
  notifyStatusChangedEvent,
} from '@/lib/notifications';
import { uploadService } from '@/lib/upload';
import {
  reviewerOwnsDocument,
  reviewerOwnsVisa,
} from '@/lib/reviewer-access';
import type {
  ActionResponse,
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

async function denyReviewerUnlessAssigned(
  session: { user: { id: string; role?: string } },
  applicationId: string,
  applicationType: 'visa' | 'passport'
): Promise<ActionResponse | null> {
  if (session.user.role !== 'reviewer') return null;
  if (applicationType !== 'visa') {
    return { success: false, message: 'Application not found' };
  }
  const allowed = await reviewerOwnsVisa(session.user.id, applicationId);
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

    const { applicationId, applicationType, newStatus, notes, travellerId } =
      request;

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

    const denied = await denyReviewerUnlessAssigned(
      session,
      applicationId,
      applicationType
    );
    if (denied) return denied;

    // Get current application
    let currentStatus: string;
    let travellerReviewedAt: Date | null = null;
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

    const now = new Date();

    // Update application status
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
    }

    // Insert status history for audit trail
    await db.insert(statusHistory).values({
      applicationId,
      applicationType,
      travellerId: applicationType === 'visa' ? travellerId : null,
      oldStatus: currentStatus,
      newStatus,
      changedBy: session.user.id,
      notes: notes || null,
      createdAt: now,
    });

    if (applicationType === 'visa') {
      await recomputeVisaCaseStatus(applicationId);
    }

    // Revalidate pages
    revalidatePath('/admin/applications');
    revalidatePath(`/admin/applications/${applicationType}/${applicationId}`);
    if (applicationType === 'visa') {
      revalidatePath(`/applications/visa/${applicationId}`);
      revalidatePath('/applications');
      revalidatePath('/dashboard');
      try {
        await notifyStatusChangedEvent({
          applicationId,
          actorId: session.user.id,
          newStatus,
          notes,
        });
      } catch (notifyError) {
        console.error('Status notification failed', notifyError);
      }
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
    const { applicationId, phone, note } = request;

    if (!applicationId || !phone?.trim() || !note?.trim()) {
      return {
        success: false,
        message: 'Missing required fields',
        error: 'applicationId, phone, and note are required',
      };
    }

    const denied = await denyReviewerUnlessAssigned(
      session,
      applicationId,
      'visa'
    );
    if (denied) return denied;

    const [app] = await db
      .select({ id: visaApplications.id })
      .from(visaApplications)
      .where(eq(visaApplications.id, applicationId))
      .limit(1);

    if (!app) {
      return { success: false, message: 'Application not found' };
    }

    await db.insert(applicationCallLogs).values({
      applicationId,
      phone: phone.trim().slice(0, 30),
      note: note.trim(),
      adminUserId: session.user.id,
      adminName: session.user.name || 'Admin',
      createdAt: new Date(),
    });

    revalidatePath(`/admin/applications/visa/${applicationId}`);

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

    await db.insert(users).values({
      name,
      email,
      phone,
      passwordHash,
      role: 'reviewer',
      emailVerified: new Date(),
    });

    revalidatePath('/admin/users');

    await notifyReviewerWelcome({ name, email });

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

const OPEN_VISA_COUNT = sql<number>`count(${visaApplications.id}) filter (where ${visaApplications.status} not in ('approved', 'rejected', 'partially_approved', 'draft'))`;

/**
 * Search reviewers for assignment. Returns at most 5, lowest open workload first.
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
  const filters = [eq(users.role, 'reviewer')];

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
        openCount: OPEN_VISA_COUNT,
      })
      .from(users)
      .leftJoin(
        visaApplications,
        eq(visaApplications.assignedReviewerId, users.id)
      )
      .where(and(...filters))
      .groupBy(users.id, users.name, users.email)
      .orderBy(asc(OPEN_VISA_COUNT), asc(users.name))
      .limit(5);

    return {
      success: true,
      message: 'Reviewers loaded',
      data: rows.map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
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

    if (!reviewer || reviewer.role !== 'reviewer') {
      return {
        success: false,
        message: 'Reviewer not found',
        error: 'Selected user is not a reviewer',
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
    revalidatePath(`/admin/applications/visa/${applicationId}`);

    await notifyReviewerAssigned({
      email: reviewer.email,
      reviewerName: reviewer.name,
      applicantName: application.applicantName || 'Applicant',
      country: application.country || application.countryCode || 'Unknown',
      visaType: application.visaType,
      applicationId,
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

function revalidateVisaSurfaces(applicationId: string) {
  revalidatePath('/admin');
  revalidatePath('/admin/applications');
  revalidatePath(`/admin/applications/visa/${applicationId}`);
  revalidatePath(`/applications/visa/${applicationId}`);
  revalidatePath(`/applications/visa/${applicationId}/fix`);
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
    revalidateVisaSurfaces(applicationId);
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

    if (
      await reviewerAccessDenied(
        session.user.id,
        session.user.role,
        request.applicationId
      )
    ) {
      return { success: false, message: 'Application not found' };
    }

    const now = new Date();
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
        body: 'Updates accepted. Review is continuing.',
        createdAt: now,
      });
      await tx.insert(statusHistory).values({
        applicationId: request.applicationId,
        applicationType: 'visa',
        travellerId: request.travellerId,
        oldStatus: 'under_review',
        newStatus: 'under_review',
        changedBy: session.user.id,
        notes: 'Accepted applicant updates',
        createdAt: now,
      });
    });

    revalidateVisaSurfaces(request.applicationId);
    try {
      await notifyCommentEvent({
        applicationId: request.applicationId,
        authorId: session.user.id,
        authorName: session.user.name || 'Reviewer',
        authorRole: staffRole(session.user.role),
        body: 'Updates accepted. Review is continuing.',
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
      .select({ id: visaApplications.id })
      .from(visaApplications)
      .where(eq(visaApplications.id, applicationId))
      .limit(1);
    if (!application) {
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

    revalidateVisaSurfaces(applicationId);
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
