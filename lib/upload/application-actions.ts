/**
 * Applicant document upload helpers (Phase 1).
 * Called at Phase 3 submit — not wired to the apply UI yet.
 */

'use server';

import { auth } from '@/lib/auth';
import { uploadService } from '@/lib/upload';
import {
  APPLICATION_UPLOAD_FOLDER,
  buildApplicationObjectKey,
  extensionFromMime,
} from '@/lib/upload/applicationKey';

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
    const userId = session?.user?.id;
    if (!userId) {
      return { success: false, error: 'You must be signed in to upload documents.' };
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
