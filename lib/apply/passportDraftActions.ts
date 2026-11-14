/**
 * Passport draft applications live in passport_services with status=draft.
 */

'use server';

import { and, desc, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { resolveSessionUserId } from '@/lib/auth/session-user';
import { db } from '@/lib/db';
import { documents, passportServices } from '@/lib/db/schema';
import { passportListings } from '@/lib/db/schema-passport';
import { ensureUniquePassportReferenceNumber } from '@/lib/passport/reference-number';
import { uploadService } from '@/lib/upload';
import { assertSafeStorageKey } from '@/lib/upload/safeStorageKey';

export type PassportDraftPayload = {
  answers?: Record<string, unknown>;
  priceOptionId?: string;
  uploadedDocuments?: Record<string, unknown>;
  macro?: string;
  stepIndex?: number;
};

type DraftSaveSuccess = {
  success: true;
  applicationId: string;
  referenceNumber: string;
};

function buildPayloadFromRow(row: {
  answers: unknown;
  priceOptionId: string | null;
  documents: unknown;
  personalInfo: unknown;
}): PassportDraftPayload {
  const personal =
    row.personalInfo && typeof row.personalInfo === 'object'
      ? (row.personalInfo as Record<string, unknown>)
      : {};
  const wizard =
    personal.wizardDraft && typeof personal.wizardDraft === 'object'
      ? (personal.wizardDraft as PassportDraftPayload)
      : {};

  return {
    answers:
      (row.answers as Record<string, unknown> | null) ??
      wizard.answers ??
      {},
    priceOptionId: row.priceOptionId ?? wizard.priceOptionId,
    uploadedDocuments:
      (typeof wizard.uploadedDocuments === 'object' &&
        wizard.uploadedDocuments) ||
      (typeof row.documents === 'object' && row.documents
        ? Object.fromEntries(
            (Array.isArray(row.documents) ? row.documents : []).map(
              (doc: { slotKey?: string; key?: string }) => [
                doc.slotKey || '',
                doc,
              ]
            )
          )
        : {}) ||
      {},
    macro: wizard.macro,
    stepIndex: wizard.stepIndex,
  };
}

async function deletePassportDraftFiles(applicationId: string, documentsJson: unknown) {
  const keys = new Set<string>();
  if (Array.isArray(documentsJson)) {
    for (const doc of documentsJson) {
      if (doc && typeof doc === 'object' && typeof (doc as { key?: string }).key === 'string') {
        keys.add((doc as { key: string }).key);
      }
    }
  }

  const rows = await db
    .select({ s3Key: documents.s3Key })
    .from(documents)
    .where(
      and(
        eq(documents.applicationId, applicationId),
        eq(documents.applicationType, 'passport')
      )
    );
  for (const row of rows) keys.add(row.s3Key);

  for (const key of keys) {
    try {
      await uploadService.delete({ key: assertSafeStorageKey(key) });
    } catch (error) {
      console.warn('[Passport draft] Failed to delete key:', key, error);
    }
  }

  await db
    .delete(documents)
    .where(
      and(
        eq(documents.applicationId, applicationId),
        eq(documents.applicationType, 'passport')
      )
    );
}

export async function savePassportDraft(input: {
  listingId: string;
  payload: PassportDraftPayload;
}): Promise<DraftSaveSuccess | { success: false; error: string }> {
  const session = await auth();
  const userId = session?.user
    ? await resolveSessionUserId(session.user)
    : null;
  if (!userId) return { success: false, error: 'Sign in to save.' };

  const [listing] = await db
    .select({
      id: passportListings.id,
      serviceType: passportListings.serviceType,
    })
    .from(passportListings)
    .where(eq(passportListings.id, input.listingId))
    .limit(1);

  if (!listing) {
    return { success: false, error: 'Passport listing not found' };
  }

  const now = new Date();
  const payload = input.payload ?? {};
  const documentsJson = payload.uploadedDocuments
    ? Object.entries(payload.uploadedDocuments).map(([slotKey, value]) => {
        const file =
          value && typeof value === 'object'
            ? (value as Record<string, unknown>)
            : {};
        return {
          slotKey,
          key:
            typeof file.storageKey === 'string'
              ? file.storageKey
              : typeof file.key === 'string'
                ? file.key
                : undefined,
          url: typeof file.url === 'string' ? file.url : undefined,
          mimeType:
            typeof file.mimeType === 'string' ? file.mimeType : undefined,
          filename:
            typeof file.filename === 'string' ? file.filename : undefined,
          size: typeof file.size === 'number' ? file.size : undefined,
        };
      })
    : [];

  const [existing] = await db
    .select({
      id: passportServices.id,
      referenceNumber: passportServices.referenceNumber,
    })
    .from(passportServices)
    .where(
      and(
        eq(passportServices.userId, userId),
        eq(passportServices.passportListingId, input.listingId),
        eq(passportServices.status, 'draft')
      )
    )
    .limit(1);

  try {
    if (existing) {
      await db
        .update(passportServices)
        .set({
          priceOptionId: payload.priceOptionId || null,
          answers: payload.answers ?? {},
          personalInfo: {
            wizardDraft: payload,
            ...(payload.answers ?? {}),
          },
          documents: documentsJson,
          savedByUserId: userId,
          updatedAt: now,
        })
        .where(eq(passportServices.id, existing.id));

      return {
        success: true,
        applicationId: existing.id,
        referenceNumber: existing.referenceNumber || '',
      };
    }

    const referenceNumber = await ensureUniquePassportReferenceNumber(db);
    const [row] = await db
      .insert(passportServices)
      .values({
        userId,
        serviceType: listing.serviceType,
        passportListingId: input.listingId,
        priceOptionId: payload.priceOptionId || null,
        answers: payload.answers ?? {},
        referenceNumber,
        status: 'draft',
        personalInfo: {
          wizardDraft: payload,
          ...(payload.answers ?? {}),
        },
        documents: documentsJson,
        savedByUserId: userId,
        updatedAt: now,
      })
      .returning({
        id: passportServices.id,
        referenceNumber: passportServices.referenceNumber,
      });

    return {
      success: true,
      applicationId: row.id,
      referenceNumber: row.referenceNumber || referenceNumber,
    };
  } catch (error) {
    console.error('savePassportDraft error:', error);
    return { success: false, error: 'Could not save draft.' };
  }
}

/** Bump updatedAt when the user resumes a passport draft. */
export async function touchPassportDraft(listingId: string): Promise<
  | { success: true; updatedAt: string; applicationId: string }
  | { success: false; error: string }
> {
  const session = await auth();
  const userId = session?.user
    ? await resolveSessionUserId(session.user)
    : null;
  if (!userId) return { success: false, error: 'Not signed in' };

  const now = new Date();
  const [row] = await db
    .update(passportServices)
    .set({ updatedAt: now })
    .where(
      and(
        eq(passportServices.userId, userId),
        eq(passportServices.passportListingId, listingId),
        eq(passportServices.status, 'draft')
      )
    )
    .returning({
      id: passportServices.id,
      updatedAt: passportServices.updatedAt,
    });

  if (!row) {
    return { success: false, error: 'Draft application not found' };
  }

  return {
    success: true,
    updatedAt: row.updatedAt.toISOString(),
    applicationId: row.id,
  };
}

export async function loadPassportDraft(listingId: string) {
  const session = await auth();
  const userId = session?.user
    ? await resolveSessionUserId(session.user)
    : null;
  if (!userId) return { success: false as const, draft: null };

  const [existing] = await db
    .select({
      id: passportServices.id,
      referenceNumber: passportServices.referenceNumber,
      answers: passportServices.answers,
      priceOptionId: passportServices.priceOptionId,
      documents: passportServices.documents,
      personalInfo: passportServices.personalInfo,
    })
    .from(passportServices)
    .where(
      and(
        eq(passportServices.userId, userId),
        eq(passportServices.passportListingId, listingId),
        eq(passportServices.status, 'draft')
      )
    )
    .limit(1);

  if (!existing) {
    return { success: true as const, draft: null };
  }

  // Resuming this draft — refresh updatedAt for dashboard/admin ordering.
  const now = new Date();
  await db
    .update(passportServices)
    .set({ updatedAt: now })
    .where(eq(passportServices.id, existing.id));

  return {
    success: true as const,
    draft: {
      ...buildPayloadFromRow(existing),
      applicationId: existing.id,
      referenceNumber: existing.referenceNumber,
    },
  };
}

export async function listMyPassportDrafts(): Promise<
  | {
      success: true;
      drafts: Array<{
        id: string;
        listingId: string;
        listingSlug: string | null;
        referenceNumber: string;
        updatedAt: string;
        serviceType: string;
        payload: PassportDraftPayload;
      }>;
    }
  | { success: false; error: string }
> {
  const session = await auth();
  const userId = session?.user
    ? await resolveSessionUserId(session.user)
    : null;
  if (!userId) return { success: false, error: 'Not signed in' };

  const rows = await db
    .select({
      id: passportServices.id,
      listingId: passportServices.passportListingId,
      referenceNumber: passportServices.referenceNumber,
      updatedAt: passportServices.updatedAt,
      serviceType: passportServices.serviceType,
      answers: passportServices.answers,
      priceOptionId: passportServices.priceOptionId,
      documents: passportServices.documents,
      personalInfo: passportServices.personalInfo,
      listingSlug: passportListings.slug,
    })
    .from(passportServices)
    .leftJoin(
      passportListings,
      eq(passportServices.passportListingId, passportListings.id)
    )
    .where(
      and(
        eq(passportServices.userId, userId),
        eq(passportServices.status, 'draft')
      )
    )
    .orderBy(desc(passportServices.updatedAt));

  return {
    success: true,
    drafts: rows
      .filter((row) => Boolean(row.listingId))
      .map((row) => ({
        id: row.id,
        listingId: row.listingId as string,
        listingSlug: row.listingSlug,
        referenceNumber: row.referenceNumber || '',
        updatedAt: row.updatedAt.toISOString(),
        serviceType: row.serviceType,
        payload: buildPayloadFromRow(row),
      })),
  };
}

export async function deletePassportDraft(
  listingId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await auth();
  const userId = session?.user
    ? await resolveSessionUserId(session.user)
    : null;
  if (!userId) return { success: false, error: 'Not signed in' };

  try {
    const [row] = await db
      .select({
        id: passportServices.id,
        documents: passportServices.documents,
      })
      .from(passportServices)
      .where(
        and(
          eq(passportServices.userId, userId),
          eq(passportServices.passportListingId, listingId),
          eq(passportServices.status, 'draft')
        )
      )
      .limit(1);

    if (row) {
      await deletePassportDraftFiles(row.id, row.documents);
      await db.delete(passportServices).where(eq(passportServices.id, row.id));
    }
    return { success: true };
  } catch (error) {
    console.error('deletePassportDraft error:', error);
    return { success: false, error: 'Could not discard draft' };
  }
}
