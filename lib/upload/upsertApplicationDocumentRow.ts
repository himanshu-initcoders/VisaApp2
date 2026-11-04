/**
 * Update an existing documents row for a passenger+slot, or insert when missing.
 * Avoids accumulating duplicate rows on every correction reupload.
 */

import { and, eq } from 'drizzle-orm';
import { documents } from '@/lib/db/schema';

type DbLike = {
  // Drizzle transaction and db share these query builders.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  select: (...args: any[]) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  insert: (...args: any[]) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  update: (...args: any[]) => any;
};

export async function upsertApplicationDocumentRow(
  tx: DbLike,
  input: {
    applicationId: string;
    passengerId: string;
    slotKey: string;
    previousKey?: string | null;
    key: string;
    filename: string;
    size: number;
    mimeType: string;
    now: Date;
  }
): Promise<void> {
  const rows = await tx
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.applicationId, input.applicationId),
        eq(documents.applicationType, 'visa'),
        eq(documents.documentType, input.slotKey)
      )
    );

  const match =
    rows.find(
      (row: { s3Key: string }) =>
        Boolean(input.previousKey) && row.s3Key === input.previousKey
    ) ||
    rows.find(
      (row: { s3Key: string }) =>
        row.s3Key.includes(`/passengers/${input.passengerId}/`) ||
        row.s3Key.includes(input.passengerId)
    ) ||
    (rows.length === 1 ? rows[0] : undefined);

  if (match) {
    await tx
      .update(documents)
      .set({
        s3Key: input.key,
        filename: input.filename,
        fileSize: input.size,
        mimeType: input.mimeType,
        verified: null,
        uploadedAt: input.now,
      })
      .where(eq(documents.id, match.id));
    return;
  }

  await tx.insert(documents).values({
    applicationId: input.applicationId,
    applicationType: 'visa' as const,
    documentType: input.slotKey,
    s3Key: input.key,
    filename: input.filename,
    fileSize: input.size,
    mimeType: input.mimeType,
    verified: null,
    uploadedAt: input.now,
  });
}
