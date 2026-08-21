'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import {
  visaApplications,
  passportServices,
  documents,
  statusHistory,
  users,
} from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { requireRole, isValidStatusTransition, isAdmin } from '@/lib/auth-utils';
import type {
  ActionResponse,
  StatusUpdateRequest,
  DocumentVerificationRequest,
  AddNoteRequest,
  UpdateUserRoleRequest,
} from '@/types/admin';

/**
 * Admin Server Actions
 *
 * All admin mutations with proper authorization and audit logging
 * Each action uses requireRole(['admin', 'reviewer']) for security
 */

/**
 * Update application status with validation and audit logging
 */
export async function updateApplicationStatus(
  request: StatusUpdateRequest
): Promise<ActionResponse> {
  try {
    // Authorization check
    const session = await requireRole(['admin', 'reviewer']);

    const { applicationId, applicationType, newStatus, notes } = request;

    // Validation
    if (!applicationId || !applicationType || !newStatus) {
      return {
        success: false,
        message: 'Missing required fields',
        error: 'applicationId, applicationType, and newStatus are required',
      };
    }

    // Get current application
    let currentApplication: any;
    if (applicationType === 'visa') {
      const result = await db
        .select()
        .from(visaApplications)
        .where(eq(visaApplications.id, applicationId))
        .limit(1);

      if (!result || result.length === 0) {
        return {
          success: false,
          message: 'Application not found',
          error: 'Visa application does not exist',
        };
      }

      currentApplication = result[0];
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

      currentApplication = result[0];
    }

    const currentStatus = currentApplication.status;

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

    // Update application status
    if (applicationType === 'visa') {
      await db
        .update(visaApplications)
        .set({
          status: newStatus,
          updatedAt: new Date(),
          ...(newStatus === 'approved' || newStatus === 'rejected'
            ? { completedAt: new Date() }
            : {}),
          ...(newStatus === 'under_review' ? { reviewedAt: new Date() } : {}),
        })
        .where(eq(visaApplications.id, applicationId));
    } else {
      await db
        .update(passportServices)
        .set({
          status: newStatus,
          updatedAt: new Date(),
          ...(newStatus === 'approved' || newStatus === 'rejected'
            ? { completedAt: new Date() }
            : {}),
        })
        .where(eq(passportServices.id, applicationId));
    }

    // Insert status history for audit trail
    await db.insert(statusHistory).values({
      applicationId,
      applicationType,
      oldStatus: currentStatus,
      newStatus,
      changedBy: session.user.id,
      notes: notes || null,
      createdAt: new Date(),
    });

    // Revalidate pages
    revalidatePath('/admin/applications');
    revalidatePath(`/admin/applications/${applicationType}/${applicationId}`);

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
    // Authorization check
    await requireRole(['admin', 'reviewer']);

    const { documentId, verified, notes } = request;

    if (!documentId) {
      return {
        success: false,
        message: 'Document ID is required',
        error: 'documentId is required',
      };
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
 * Add internal note to application
 */
export async function addApplicationNote(
  request: AddNoteRequest
): Promise<ActionResponse> {
  try {
    // Authorization check
    const session = await requireRole(['admin', 'reviewer']);

    const { applicationId, applicationType, note } = request;

    if (!applicationId || !applicationType || !note || note.trim() === '') {
      return {
        success: false,
        message: 'Missing required fields',
        error: 'applicationId, applicationType, and note are required',
      };
    }

    // Validate note length
    if (note.length > 1000) {
      return {
        success: false,
        message: 'Note is too long',
        error: 'Note must be 1000 characters or less',
      };
    }

    // Get current status
    let currentStatus: string;
    if (applicationType === 'visa') {
      const result = await db
        .select({ status: visaApplications.status })
        .from(visaApplications)
        .where(eq(visaApplications.id, applicationId))
        .limit(1);

      if (!result || result.length === 0) {
        return {
          success: false,
          message: 'Application not found',
        };
      }

      currentStatus = result[0].status;
    } else {
      const result = await db
        .select({ status: passportServices.status })
        .from(passportServices)
        .where(eq(passportServices.id, applicationId))
        .limit(1);

      if (!result || result.length === 0) {
        return {
          success: false,
          message: 'Application not found',
        };
      }

      currentStatus = result[0].status;
    }

    // Insert status history entry with note (no status change)
    await db.insert(statusHistory).values({
      applicationId,
      applicationType,
      oldStatus: currentStatus,
      newStatus: currentStatus,
      changedBy: session.user.id,
      notes: note,
      createdAt: new Date(),
    });

    // Revalidate page
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
