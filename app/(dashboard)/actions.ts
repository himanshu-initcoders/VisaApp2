'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { signOut, auth } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  documents,
  passportServices,
  users,
  visaApplications,
} from '@/lib/db/schema';
import { uploadService } from '@/lib/upload';
import { updateProfileSchema } from '@/lib/validations/auth';
import type { ActionResponse } from '@/types/admin';

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
