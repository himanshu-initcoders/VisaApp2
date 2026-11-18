/**
 * Update an existing documents row for a passenger+slot, or insert when missing.
 * Avoids accumulating duplicate rows on every correction reupload.
 *
 * Never steals another passenger's row for the same slot — multi-traveller
 * apps share document_type values (e.g. passport-front) across passengers.
 */

import { and, eq } from 'drizzle-orm';
import { documents } from '@/lib/db/schema';
import { extractPassengerIdFromObjectKey } from '@/lib/upload/applicationKey';

type DbLike = {
  // Drizzle transaction and db share these query builders.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  select: (...args: any[]) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  insert: (...args: any[]) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  update: (...args: any[]) => any;
};

function rowBelongsToPassenger(
  s3Key: string,
  passengerId: string
): boolean {
  if (!passengerId) return false;
  return s3Key.includes(`/passengers/${passengerId}/`);
}

export async function upsertApplicationDocumentRow(
  tx: DbLike,
  input: {
    applicationId: string;
    applicationType?: 'visa' | 'passport';
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
  const applicationType = input.applicationType ?? 'visa';
  const rows = await tx
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.applicationId, input.applicationId),
        eq(documents.applicationType, applicationType),
        eq(documents.documentType, input.slotKey)
      )
    );

  const match =
    rows.find(
      (row: { s3Key: string }) =>
        Boolean(input.previousKey) && row.s3Key === input.previousKey
    ) ||
    rows.find((row: { s3Key: string }) =>
      rowBelongsToPassenger(row.s3Key, input.passengerId)
    ) ||
    // Legacy single-file apps stored keys without /passengers/{id}/.
    // Only reuse that lone row when it has no passenger segment.
    (rows.length === 1 &&
    extractPassengerIdFromObjectKey(rows[0].s3Key) == null
      ? rows[0]
      : undefined);

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
    applicationType,
    documentType: input.slotKey,
    s3Key: input.key,
    filename: input.filename,
    fileSize: input.size,
    mimeType: input.mimeType,
    verified: null,
    uploadedAt: input.now,
  });
}
