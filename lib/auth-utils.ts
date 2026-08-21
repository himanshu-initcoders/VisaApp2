import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { User } from '@/lib/db/schema';

/**
 * Authorization Utilities
 *
 * Provides type-safe role checking and access control for admin routes
 */

/**
 * Requires user to be authenticated
 * Redirects to login if not authenticated
 */
export async function requireAuth() {
  const session = await auth();

  if (!session || !session.user) {
    redirect('/login');
  }

  return session;
}

/**
 * Requires user to have one of the specified roles
 * Redirects to dashboard with error if unauthorized
 *
 * @param roles - Array of allowed roles (e.g., ['admin', 'reviewer'])
 */
export async function requireRole(roles: string[]) {
  const session = await requireAuth();

  const userRole = session.user.role;

  if (!userRole || !roles.includes(userRole)) {
    redirect('/dashboard?error=unauthorized');
  }

  return session;
}

/**
 * Type-safe check if user is an admin
 */
export function isAdmin(user: { role?: string }): boolean {
  return user.role === 'admin';
}

/**
 * Type-safe check if user is a reviewer
 */
export function isReviewer(user: { role?: string }): boolean {
  return user.role === 'reviewer';
}

/**
 * Type-safe check if user has admin or reviewer role
 */
export function canAccessAdmin(user: { role?: string }): boolean {
  return isAdmin(user) || isReviewer(user);
}

/**
 * Check if user can access a specific application
 *
 * Rules:
 * - Admins and reviewers can access any application
 * - Regular users can only access their own applications
 *
 * @param userId - ID of the user making the request
 * @param applicationUserId - User ID from the application record
 * @param userRole - Role of the user making the request
 */
export function canAccessApplication(
  userId: string,
  applicationUserId: string,
  userRole: string
): boolean {
  // Admins and reviewers can access any application
  if (userRole === 'admin' || userRole === 'reviewer') {
    return true;
  }

  // Regular users can only access their own applications
  return userId === applicationUserId;
}

/**
 * Validate status transition to prevent invalid workflow changes
 *
 * Valid transitions:
 * - draft → submitted
 * - submitted → under_review
 * - under_review → approved | rejected
 * - approved/rejected → (terminal states, no transitions)
 */
export function isValidStatusTransition(
  currentStatus: string,
  newStatus: string
): boolean {
  const validTransitions: Record<string, string[]> = {
    draft: ['submitted'],
    submitted: ['under_review'],
    under_review: ['approved', 'rejected', 'submitted'], // Can send back for resubmission
    approved: [], // Terminal state
    rejected: ['submitted'], // Can resubmit after rejection
  };

  const allowedNextStates = validTransitions[currentStatus];

  if (!allowedNextStates) {
    return false;
  }

  return allowedNextStates.includes(newStatus);
}
