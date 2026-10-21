'use server';

import { revalidatePath } from 'next/cache';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { documentTypes } from '@/lib/db/schema-extended';
import { requireRole } from '@/lib/auth-utils';
import {
  createDocumentTypeSchema,
  updateDocumentTypeLabelSchema,
} from '@/lib/validations/config';
import {
  uploadService,
  buildDocumentSampleObjectKey,
  sampleExtensionFromUpload,
  maxSampleSizeMb,
  DOCUMENT_SAMPLE_UPLOAD_FOLDER,
  DOCUMENT_SAMPLE_ALLOWED_TYPES,
} from '@/lib/upload';

function revalidateDocumentTypePaths() {
  revalidatePath('/admin/config/document-types');
  revalidatePath('/admin/config/visa-listings');
}

/**
 * Create a new document type (slug immutable after create).
 */
export async function createDocumentType(data: unknown) {
  await requireRole(['admin']);

  try {
    const validated = createDocumentTypeSchema.parse(data);

    const existing = await db.query.documentTypes.findFirst({
      where: eq(documentTypes.value, validated.value),
      columns: { id: true },
    });

    if (existing) {
      return { error: `A document type with slug "${validated.value}" already exists` };
    }

    const [{ maxSort } = { maxSort: 0 }] = await db
      .select({ maxSort: sql<number>`coalesce(max(${documentTypes.sortOrder}), -1)` })
      .from(documentTypes);

    const [created] = await db
      .insert(documentTypes)
      .values({
        value: validated.value,
        label: validated.label,
        sortOrder: Number(maxSort) + 1,
      })
      .returning();

    revalidateDocumentTypePaths();

    return { success: true as const, documentType: created };
  } catch (error) {
    console.error('Error creating document type:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return { error: 'Invalid document type data' };
    }
    return { error: 'Failed to create document type' };
  }
}

/**
 * Update display name only (slug is never changed).
 */
export async function updateDocumentTypeLabel(data: unknown) {
  await requireRole(['admin']);

  try {
    const validated = updateDocumentTypeLabelSchema.parse(data);

    const existing = await db.query.documentTypes.findFirst({
      where: eq(documentTypes.id, validated.id),
      columns: { id: true },
    });

    if (!existing) {
      return { error: 'Document type not found' };
    }

    const [updated] = await db
      .update(documentTypes)
      .set({
        label: validated.label,
        updatedAt: new Date(),
      })
      .where(eq(documentTypes.id, validated.id))
      .returning();

    revalidateDocumentTypePaths();

    return { success: true as const, documentType: updated };
  } catch (error) {
    console.error('Error updating document type label:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return { error: 'Invalid document type data' };
    }
    return { error: 'Failed to update document type' };
  }
}

/**
 * Upload or replace the sample document for a document type.
 * Uploads the new file first, then deletes the previous storage object.
 */
export async function uploadOrReplaceSampleDocument(
  documentTypeId: string,
  fileData: {
    buffer: number[];
    filename: string;
    mimeType: string;
    size: number;
  }
) {
  await requireRole(['admin']);

  try {
    const row = await db.query.documentTypes.findFirst({
      where: eq(documentTypes.id, documentTypeId),
    });

    if (!row) {
      return { error: 'Document type not found' };
    }

    const mimeType = fileData.mimeType;
    if (
      !DOCUMENT_SAMPLE_ALLOWED_TYPES.includes(
        mimeType as (typeof DOCUMENT_SAMPLE_ALLOWED_TYPES)[number]
      )
    ) {
      return { error: 'Only JPG, PNG, WEBP, or PDF files are allowed' };
    }

    const maxMb = maxSampleSizeMb(mimeType);
    if (fileData.size > maxMb * 1024 * 1024) {
      return { error: `File is too large. Max ${maxMb}MB for this type.` };
    }

    const ext = sampleExtensionFromUpload(mimeType, fileData.filename);
    const explicitKey = buildDocumentSampleObjectKey({
      slug: row.value,
      ext,
    });

    const buffer = Buffer.from(fileData.buffer);
    const result = await uploadService.replaceImage(buffer, {
      folder: DOCUMENT_SAMPLE_UPLOAD_FOLDER,
      filename: fileData.filename,
      explicitKey,
      maxSizeMB: maxMb,
      allowedTypes: [...DOCUMENT_SAMPLE_ALLOWED_TYPES],
      oldKey: row.sampleDocumentKey || undefined,
    });

    const [updated] = await db
      .update(documentTypes)
      .set({
        sampleDocumentKey: result.key,
        sampleDocumentUrl: result.url,
        sampleDocumentFilename: fileData.filename,
        sampleDocumentMimeType: mimeType,
        updatedAt: new Date(),
      })
      .where(eq(documentTypes.id, documentTypeId))
      .returning();

    revalidateDocumentTypePaths();

    return { success: true as const, documentType: updated };
  } catch (error) {
    console.error('Error uploading sample document:', error);
    return {
      error: error instanceof Error ? error.message : 'Failed to upload sample document',
    };
  }
}
