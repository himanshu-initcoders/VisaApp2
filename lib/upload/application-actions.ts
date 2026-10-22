/**
 * Applicant document upload helpers — submit + draft sync.
 */

'use server';

import { promises as fs } from 'fs';
import path from 'path';
import { auth } from '@/lib/auth';
import { resolveSessionUserId } from '@/lib/auth/session-user';
import { canAccessAdmin } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { uploadService } from '@/lib/upload';
import {
  APPLICATION_UPLOAD_FOLDER,
  buildApplicationObjectKey,
  buildDraftObjectKey,
  extensionFromMime,
  isDraftObjectKey,
} from '@/lib/upload/applicationKey';
import {
  UPLOADS_ROOT,
  assertSafeStorageKey,
} from '@/lib/upload/safeStorageKey';

export interface ApplicationDocumentUploadItem {
  passengerId: string;
  slotKey: string;
  filename: string;
  mimeType: string;
  /** Base64 file body (ArrayBuffer serialized from client). */
  bufferBase64: string;
}

export interface ApplicationDocumentUploadInput {
  countryCode: string;
  listingId: string;
  applicationId: string;
  documents: ApplicationDocumentUploadItem[];
}

export interface ApplicationDocumentUploadResult {
  passengerId: string;
  slotKey: string;
  key: string;
  url: string;
  mimeType: string;
  filename: string;
  size: number;
}

function decodeBase64(base64: string): Buffer {
  return Buffer.from(base64, 'base64');
}

/**
 * Upload applicant documents to the configured provider using nested keys.
 * Requires an authenticated session. Compensating delete on partial failure.
 */
export async function uploadApplicationDocuments(
  input: ApplicationDocumentUploadInput
): Promise<
  | { success: true; results: ApplicationDocumentUploadResult[] }
  | { success: false; error: string }
> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: 'You must be signed in to upload documents.' };
    }
    const userId = await resolveSessionUserId(session.user);
    if (!userId) {
      return { success: false, error: 'Your session is out of date. Sign in again.' };
    }

    if (!input.documents?.length) {
      return { success: true, results: [] };
    }

    const uploadedKeys: string[] = [];
    const results: ApplicationDocumentUploadResult[] = [];

    try {
      for (const doc of input.documents) {
        const buffer = decodeBase64(doc.bufferBase64);
        const mimeType = doc.mimeType || 'application/octet-stream';
        const ext = extensionFromMime(mimeType, doc.filename);
        const explicitKey = buildApplicationObjectKey({
          countryCode: input.countryCode,
          listingId: input.listingId,
          userId,
          applicationId: input.applicationId,
          passengerId: doc.passengerId,
          slotKey: doc.slotKey,
          ext,
        });

        const result = await uploadService.upload(buffer, {
          folder: APPLICATION_UPLOAD_FOLDER,
          filename: doc.filename,
          explicitKey,
          maxSizeMB: mimeType === 'application/pdf' ? 10 : 5,
          allowedTypes: [
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/webp',
            'application/pdf',
          ],
          metadata: {
            passengerId: doc.passengerId,
            slotKey: doc.slotKey,
            applicationId: input.applicationId,
            listingId: input.listingId,
          },
        });

        uploadedKeys.push(result.key);
        results.push({
          passengerId: doc.passengerId,
          slotKey: doc.slotKey,
          key: result.key,
          url: result.url,
          mimeType: result.mimeType,
          filename: result.filename,
          size: result.size,
        });
      }

      return { success: true, results };
    } catch (error) {
      // Compensating cleanup for partial batch
      await Promise.all(
        uploadedKeys.map(async (key) => {
          try {
            await uploadService.delete({ key });
          } catch (cleanupError) {
            console.warn('[Upload] Compensating delete failed:', key, cleanupError);
          }
        })
      );
      throw error;
    }
  } catch (error) {
    console.error('uploadApplicationDocuments error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
}

export interface DraftDocumentUploadInput {
  countryCode: string;
  listingId: string;
  /** When set by staff, files are stored under this applicant's draft path. */
  ownerUserId?: string;
  documents: ApplicationDocumentUploadItem[];
}

/**
 * Upload apply-draft documents under …/{ownerUserId}/drafts/…
 * Does not create visa_applications or documents rows.
 */
export async function uploadDraftDocuments(
  input: DraftDocumentUploadInput
): Promise<
  | { success: true; results: ApplicationDocumentUploadResult[] }
  | { success: false; error: string }
> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: 'You must be signed in to upload documents.' };
    }

    const actorId = await resolveSessionUserId(session.user);
    if (!actorId) {
      return { success: false, error: 'Your session is out of date. Sign in again.' };
    }

    let ownerUserId = actorId;
    if (input.ownerUserId && input.ownerUserId !== actorId) {
      if (!canAccessAdmin({ role: session.user.role })) {
        return { success: false, error: 'Not allowed to upload drafts for another user.' };
      }
      const [target] = await db
        .select({ id: users.id, role: users.role })
        .from(users)
        .where(eq(users.id, input.ownerUserId))
        .limit(1);
      if (!target) {
        return { success: false, error: 'Applicant not found' };
      }
      ownerUserId = target.id;
    }

    if (!input.documents?.length) {
      return { success: true, results: [] };
    }

    const uploadedKeys: string[] = [];
    const results: ApplicationDocumentUploadResult[] = [];

    try {
      for (const doc of input.documents) {
        const buffer = decodeBase64(doc.bufferBase64);
        const mimeType = doc.mimeType || 'application/octet-stream';
        const ext = extensionFromMime(mimeType, doc.filename);
        const explicitKey = buildDraftObjectKey({
          countryCode: input.countryCode,
          listingId: input.listingId,
          userId: ownerUserId,
          passengerId: doc.passengerId,
          slotKey: doc.slotKey,
          ext,
        });

        const result = await uploadService.upload(buffer, {
          folder: APPLICATION_UPLOAD_FOLDER,
          filename: doc.filename,
          explicitKey,
          maxSizeMB: mimeType === 'application/pdf' ? 10 : 5,
          allowedTypes: [
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/webp',
            'application/pdf',
          ],
          metadata: {
            passengerId: doc.passengerId,
            slotKey: doc.slotKey,
            listingId: input.listingId,
            draft: '1',
            ownerUserId,
          },
        });

        uploadedKeys.push(result.key);
        results.push({
          passengerId: doc.passengerId,
          slotKey: doc.slotKey,
          key: result.key,
          url: result.url,
          mimeType: result.mimeType,
          filename: result.filename,
          size: result.size,
        });
      }

      return { success: true, results };
    } catch (error) {
      await Promise.all(
        uploadedKeys.map(async (key) => {
          try {
            await uploadService.delete({ key });
          } catch (cleanupError) {
            console.warn('[Upload] Draft compensating delete failed:', key, cleanupError);
          }
        })
      );
      throw error;
    }
  } catch (error) {
    console.error('uploadDraftDocuments error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Draft upload failed',
    };
  }
}

/**
 * Fetch a draft (or owned) document blob for restore into IndexedDB.
 */
export async function fetchDraftDocumentBlob(input: {
  storageKey: string;
  /** Required when staff restores an applicant draft. */
  ownerUserId?: string;
}): Promise<
  | {
      success: true;
      data: { base64: string; mimeType: string; filename: string };
    }
  | { success: false; error: string }
> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: 'Unauthorized' };
    }

    const actorId = await resolveSessionUserId(session.user);
    if (!actorId) {
      return { success: false, error: 'Unauthorized' };
    }

    let storageKey: string;
    try {
      storageKey = assertSafeStorageKey(input.storageKey);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Invalid document key',
      };
    }

    let ownerUserId = actorId;
    if (input.ownerUserId && input.ownerUserId !== actorId) {
      if (!canAccessAdmin({ role: session.user.role })) {
        return { success: false, error: 'Unauthorized' };
      }
      ownerUserId = input.ownerUserId;
    }

    if (!isDraftObjectKey(storageKey, ownerUserId)) {
      return { success: false, error: 'Unauthorized' };
    }

    let buffer: Buffer | null = null;
    let mimeType = 'application/octet-stream';
    const filename = storageKey.split('/').pop() || 'document.bin';

    if (uploadService.getProviderName() === 'local') {
      try {
        const filePath = path.join(UPLOADS_ROOT, storageKey);
        buffer = await fs.readFile(filePath);
      } catch {
        buffer = null;
      }
    }

    if (!buffer) {
      const url = uploadService.getUrl(storageKey);
      const absolute =
        url.startsWith('http') || url.startsWith('//')
          ? url
          : `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}${url.startsWith('/') ? '' : '/'}${url}`;
      const response = await fetch(absolute);
      if (!response.ok) {
        return { success: false, error: 'Could not download draft file' };
      }
      const arrayBuffer = await response.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      mimeType = response.headers.get('content-type') || mimeType;
    }

    if (filename.endsWith('.pdf')) mimeType = 'application/pdf';
    else if (filename.endsWith('.png')) mimeType = 'image/png';
    else if (filename.endsWith('.webp')) mimeType = 'image/webp';
    else if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) {
      mimeType = 'image/jpeg';
    }

    return {
      success: true,
      data: {
        base64: buffer.toString('base64'),
        mimeType,
        filename,
      },
    };
  } catch (error) {
    console.error('fetchDraftDocumentBlob error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Download failed',
    };
  }
}
