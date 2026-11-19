/**
 * Profile-owned document vault writes.
 * Replace = insert new row + soft-unassign prior active row (never delete blob).
 */

import { and, eq } from 'drizzle-orm';
import { documents, type Document } from '@/lib/db/schema';

type DbLike = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  select: (...args: any[]) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  insert: (...args: any[]) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  update: (...args: any[]) => any;
};

export type VaultDocumentInput = {
  userId: string;
  profileId: string;
  slotKey: string;
  key: string;
  filename: string;
  size: number;
  mimeType: string;
  now?: Date;
  /**
   * replace: insert + hide prior vault-active.
   * submit: insert/adopt for submission freeze into JSON refs.
   */
  mode?: 'replace' | 'submit';
};

export type VaultDocumentResult = {
  document: Document;
  previousDocumentId: string | null;
};

async function hideActiveSlotDocuments(
  tx: DbLike,
  profileId: string,
  slotKey: string,
  exceptId: string,
  newId: string
): Promise<string | null> {
  const active = await tx
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.profileId, profileId),
        eq(documents.documentType, slotKey),
        eq(documents.visibility, 'active')
      )
    );

  let previousId: string | null = null;
  for (const row of active as Document[]) {
    if (row.id === exceptId) continue;
    previousId = previousId ?? row.id;
    await tx
      .update(documents)
      .set({
        visibility: 'hidden',
        supersededByDocumentId: newId,
      })
      .where(eq(documents.id, row.id));
  }
  return previousId;
}

/**
 * Insert a vault document for a profile slot.
 * Soft-unassigns prior active rows for the same slot.
 */
export async function upsertProfileDocument(
  tx: DbLike,
  input: VaultDocumentInput
): Promise<VaultDocumentResult> {
  const now = input.now ?? new Date();

  const activeRows = (await tx
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.profileId, input.profileId),
        eq(documents.documentType, input.slotKey),
        eq(documents.visibility, 'active')
      )
    )) as Document[];

  const active = activeRows[0] ?? null;

  // Same storage key already active — refresh metadata only.
  if (active && active.s3Key === input.key) {
    const [updated] = await tx
      .update(documents)
      .set({
        userId: input.userId,
        filename: input.filename,
        fileSize: input.size,
        mimeType: input.mimeType,
        uploadedAt: now,
      })
      .where(eq(documents.id, active.id))
      .returning();
    return {
      document: updated ?? active,
      previousDocumentId: null,
    };
  }

  // Adopt an existing application-path row (same key, no profile yet) into vault.
  const [byKey] = (await tx
    .select()
    .from(documents)
    .where(eq(documents.s3Key, input.key))
    .limit(1)) as Document[];

  if (byKey) {
    const [updated] = await tx
      .update(documents)
      .set({
        userId: input.userId,
        profileId: input.profileId,
        filename: input.filename,
        fileSize: input.size,
        mimeType: input.mimeType,
        visibility: 'active',
        uploadedAt: now,
      })
      .where(eq(documents.id, byKey.id))
      .returning();

    const previousDocumentId = await hideActiveSlotDocuments(
      tx,
      input.profileId,
      input.slotKey,
      (updated ?? byKey).id,
      (updated ?? byKey).id
    );

    return {
      document: updated ?? byKey,
      previousDocumentId,
    };
  }

  const [inserted] = await tx
    .insert(documents)
    .values({
      userId: input.userId,
      profileId: input.profileId,
      documentType: input.slotKey,
      s3Key: input.key,
      filename: input.filename,
      fileSize: input.size,
      mimeType: input.mimeType,
      verified: null,
      visibility: 'active',
      uploadedAt: now,
    })
    .returning();

  const previousDocumentId = await hideActiveSlotDocuments(
    tx,
    input.profileId,
    input.slotKey,
    inserted.id,
    inserted.id
  );

  return { document: inserted, previousDocumentId };
}

/**
 * Link an existing documents row (legacy app path) into the vault without
 * copying the file. Soft-unassigns other active rows for the slot when needed.
 */
export async function adoptDocumentIntoProfile(
  tx: DbLike,
  input: {
    documentId: string;
    userId: string;
    profileId: string;
    makeActive?: boolean;
    now?: Date;
  }
): Promise<Document | null> {
  const [row] = await tx
    .select()
    .from(documents)
    .where(eq(documents.id, input.documentId))
    .limit(1);
  if (!row) return null;

  const makeActive = input.makeActive !== false;
  const [updated] = await tx
    .update(documents)
    .set({
      userId: input.userId,
      profileId: input.profileId,
      visibility: makeActive ? 'active' : row.visibility || 'active',
    })
    .where(eq(documents.id, row.id))
    .returning();

  if (makeActive && updated) {
    await hideActiveSlotDocuments(
      tx,
      input.profileId,
      updated.documentType,
      updated.id,
      updated.id
    );
  }

  return updated ?? row;
}

/** Find vault/documents row by exact storage key. */
export async function findDocumentByStorageKey(
  tx: DbLike,
  s3Key: string
): Promise<Document | null> {
  const [row] = await tx
    .select()
    .from(documents)
    .where(eq(documents.s3Key, s3Key))
    .limit(1);
  return row ?? null;
}
