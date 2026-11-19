'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { documents } from '@/lib/db/schema';
import { travelerProfiles } from '@/lib/db/schema-traveler-profiles';
import { upsertProfileDocument } from '@/lib/upload/profileDocumentVault';
import {
  buildProfileObjectKey,
  PROFILE_UPLOAD_FOLDER,
} from '@/lib/upload/profileKey';
import { extensionFromMime } from '@/lib/upload/applicationKey';
import { uploadService } from '@/lib/upload';
import { isApplicantVaultSlot } from '@/lib/dashboard/vaultDocumentTypes';
import type { ActionResponse } from '@/types/admin';

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

const replaceDocumentSchema = z.object({
  profileId: z.string().uuid(),
  /** Existing vault document id being replaced (must be active + owned). */
  documentId: z.string().uuid(),
  filename: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(100),
  bufferBase64: z.string().min(1),
});

/**
 * Replace an active vault document for the signed-in user.
 * Soft-unassigns the prior row; keeps the old blob for application history.
 */
export async function replaceMyProfileDocument(
  input: unknown
): Promise<ActionResponse<{ documentId: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role === 'admin' || session.user.role === 'reviewer') {
      return { success: false, message: 'Unauthorized' };
    }

    const parsed = replaceDocumentSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        message: parsed.error.issues[0]?.message ?? 'Invalid document',
      };
    }

    const { profileId, documentId, filename, mimeType, bufferBase64 } =
      parsed.data;

    if (!ALLOWED_MIME.has(mimeType)) {
      return { success: false, message: 'Upload a JPG, PNG, WEBP, or PDF' };
    }

    const buffer = Buffer.from(bufferBase64, 'base64');
    const max =
      mimeType === 'application/pdf' ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
    if (buffer.length === 0 || buffer.length > max) {
      return { success: false, message: 'File is empty or too large' };
    }

    const [profile] = await db
      .select({ id: travelerProfiles.id })
      .from(travelerProfiles)
      .where(
        and(
          eq(travelerProfiles.id, profileId),
          eq(travelerProfiles.userId, session.user.id)
        )
      )
      .limit(1);
    if (!profile) {
      return { success: false, message: 'Profile not found' };
    }

    const [current] = await db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.id, documentId),
          eq(documents.profileId, profileId),
          eq(documents.userId, session.user.id),
          eq(documents.visibility, 'active')
        )
      )
      .limit(1);

    if (!current) {
      return { success: false, message: 'Document not found' };
    }

    const slotKey = current.documentType;
    if (!isApplicantVaultSlot(slotKey)) {
      return {
        success: false,
        message:
          'This file is an application result and cannot be changed here',
      };
    }
    const ext = extensionFromMime(mimeType, filename);
    const revision = `vault-${Date.now().toString(36)}`;
    const explicitKey = buildProfileObjectKey({
      userId: session.user.id,
      profileId,
      slotKey,
      ext,
      revision,
    });

    const uploadFilename = filename.replace(/\.[^.]+$/i, '') + `.${ext}`;
    const uploaded = await uploadService.upload(buffer, {
      folder: PROFILE_UPLOAD_FOLDER,
      filename: uploadFilename,
      mimeType,
      explicitKey,
      maxSizeMB: mimeType === 'application/pdf' ? 10 : 5,
      allowedTypes: [...ALLOWED_MIME],
      metadata: {
        profileId,
        slotKey,
        replacedDocumentId: documentId,
      },
    });

    // Library replace keeps applications frozen on prior documentId/key refs.
    const vault = await upsertProfileDocument(db, {
      userId: session.user.id,
      profileId,
      slotKey,
      key: uploaded.key,
      filename: uploaded.filename || uploadFilename,
      size: uploaded.size,
      mimeType: uploaded.mimeType || mimeType,
      mode: 'replace',
      now: new Date(),
    });

    revalidatePath('/documents');
    return {
      success: true,
      message: 'Document updated',
      data: { documentId: vault.document.id },
    };
  } catch (error) {
    console.error('replaceMyProfileDocument error:', error);
    return {
      success: false,
      message: 'Failed to update document',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
