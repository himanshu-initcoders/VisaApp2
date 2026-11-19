/**
 * Update an existing documents row for a traveller+slot, or insert when missing.
 * Lookup is by exact storage key / previousKey — no s3_key LIKE path hunt.
 */

import { and, eq, or } from 'drizzle-orm';
import { documents } from '@/lib/db/schema';
import { extractFormTravellerIdFromObjectKey } from '@/lib/upload/applicationKey';

type DbLike = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  select: (...args: any[]) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  insert: (...args: any[]) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  update: (...args: any[]) => any;
};

function rowBelongsToTraveller(s3Key: string, travellerId: string): boolean {
  if (!travellerId) return false;
  return (
    s3Key.includes(`/passengers/${travellerId}/`) ||
    s3Key.includes(`/travellers/${travellerId}/`)
  );
}

export async function upsertApplicationDocumentRow(
  tx: DbLike,
  input: {
    applicationId: string;
    /** @deprecated Ignored — documents no longer store application type. */
    applicationType?: 'visa' | 'passport';
    travellerId?: string;
    /** @deprecated Use travellerId */
    passengerId?: string;
    slotKey: string;
    previousKey?: string | null;
    key: string;
    filename: string;
    size: number;
    mimeType: string;
    userId?: string | null;
    now: Date;
  }
): Promise<void> {
  const travellerId = input.travellerId || input.passengerId || '';
  const keyMatchers = [eq(documents.s3Key, input.key)];
  if (input.previousKey) {
    keyMatchers.push(eq(documents.s3Key, input.previousKey));
  }

  const rows = await tx
    .select()
    .from(documents)
    .where(
      and(eq(documents.documentType, input.slotKey), or(...keyMatchers))
    );

  const match =
    rows.find(
      (row: { s3Key: string }) =>
        Boolean(input.previousKey) && row.s3Key === input.previousKey
    ) ||
    rows.find((row: { s3Key: string }) => row.s3Key === input.key) ||
    rows.find((row: { s3Key: string }) =>
      rowBelongsToTraveller(row.s3Key, travellerId)
    ) ||
    // Legacy single-file apps stored keys without /passengers/{id}/.
    (rows.length === 1 &&
    extractFormTravellerIdFromObjectKey(rows[0].s3Key) == null
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
        ...(input.userId ? { userId: input.userId } : {}),
      })
      .where(eq(documents.id, match.id));
    return;
  }

  await tx.insert(documents).values({
    userId: input.userId ?? null,
    documentType: input.slotKey,
    s3Key: input.key,
    filename: input.filename,
    fileSize: input.size,
    mimeType: input.mimeType,
    verified: null,
    visibility: 'active',
    uploadedAt: input.now,
  });
}
