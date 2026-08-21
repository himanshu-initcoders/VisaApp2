import { db } from '@/lib/db';
import { statusHistory } from '@/lib/db/schema';

/**
 * Audit Logging Utility
 *
 * Centralized logging for admin actions to maintain compliance and audit trail
 */

/**
 * Log an admin action to the audit trail
 *
 * Uses the statusHistory table to store admin actions for compliance.
 * All admin actions (status changes, document verifications, etc.) are logged here.
 *
 * @param action - Action type (e.g., 'STATUS_UPDATE', 'DOCUMENT_VERIFY', 'DOCUMENT_VIEW')
 * @param resourceType - Type of resource (e.g., 'visa', 'passport')
 * @param resourceId - ID of the resource (application ID or document ID)
 * @param userId - ID of the user performing the action (admin/reviewer)
 * @param metadata - Additional context about the action
 */
export async function logAdminAction(
  action: string,
  resourceType: string,
  resourceId: string,
  userId: string,
  metadata?: Record<string, any>
) {
  try {
    await db.insert(statusHistory).values({
      applicationId: resourceId,
      applicationType: resourceType,
      oldStatus: null,
      newStatus: action,
      changedBy: userId,
      notes: metadata ? JSON.stringify(metadata) : null,
    });
  } catch (error) {
    console.error('Failed to log admin action:', error);
    // Don't throw - logging failure shouldn't break the main operation
  }
}

/**
 * Action types for audit logging
 */
export const AuditActions = {
  STATUS_UPDATE: 'STATUS_UPDATE',
  DOCUMENT_VERIFY: 'DOCUMENT_VERIFY',
  DOCUMENT_VIEW: 'DOCUMENT_VIEW',
  APPLICATION_VIEW: 'APPLICATION_VIEW',
  USER_UPDATE: 'USER_UPDATE',
} as const;

export type AuditAction = (typeof AuditActions)[keyof typeof AuditActions];
