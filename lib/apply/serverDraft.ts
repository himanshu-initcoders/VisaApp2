/**
 * Visa draft applications live in visa_applications with status=draft.
 * Same row + storage path; payment only flips status to submitted.
 */

'use server';

import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { auth } from '@/lib/auth';
import { resolveSessionUserId } from '@/lib/auth/session-user';
import { canAccessAdmin } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import { documents, users, visaApplications } from '@/lib/db/schema';
import { countries, visaListings } from '@/lib/db/schema-extended';
import { deleteDraftStorageFiles } from '@/lib/apply/deleteDraftStorageFiles';
import { parseServerDraftPayload } from '@/lib/validations/draft';
import { ensureUniqueVisaReferenceNumber } from '@/lib/visa/reference-number';
import { uploadService } from '@/lib/upload';
import { assertSafeStorageKey } from '@/lib/upload/safeStorageKey';

/** Client/server draft JSON shape (validated on write via Zod). */
export interface ServerDraftPayload {
  version: number;
  updatedAt: string;
  countryCode: string;
  countryName: string;
  listingId: string;
  processName: string;
  step: string;
  primaryName: string;
  travellers: unknown[];
  departure: unknown;
  travellersCount: number;
  interestedInInsurance?: boolean;
}

export interface ApplicationDraftListItem {
  id: string;
  listingId: string;
  listingSlug: string | null;
  countryCode: string | null;
  referenceNumber: string;
  updatedAt: string;
  createdAt: string;
  payload: ServerDraftPayload;
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    role: string;
  };
  savedBy: {
    id: string;
    name: string;
    role: string;
  } | null;
}

type DraftSaveSuccess = {
  success: true;
  updatedAt: string;
  applicationId: string;
  referenceNumber: string;
};

async function requireSessionUserId(): Promise<
  { ok: true; userId: string; role: string } | { ok: false; error: string }
> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, error: 'Not signed in' };
  }

  const userId = await resolveSessionUserId(session.user);
  if (!userId) {
    return {
      ok: false,
      error: 'Your session is out of date. Sign out and sign in again.',
    };
  }

  return { ok: true, userId, role: session.user.role || 'user' };
}

function buildPayloadFromRow(row: {
  id: string;
  visaListingId: string | null;
  countryCode: string | null;
  applicantName: string | null;
  travellers: unknown;
  travelInfo: unknown;
  personalInfo: unknown;
  interestedInInsurance: boolean;
  updatedAt: Date;
}): ServerDraftPayload {
  const personal =
    row.personalInfo && typeof row.personalInfo === 'object'
      ? (row.personalInfo as Record<string, unknown>)
      : {};
  const wizard =
    personal.wizardDraft && typeof personal.wizardDraft === 'object'
      ? (personal.wizardDraft as Record<string, unknown>)
      : {};

  const countryCode =
    (typeof wizard.countryCode === 'string' && wizard.countryCode) ||
    row.countryCode ||
    '';
  const listingId =
    (typeof wizard.listingId === 'string' && wizard.listingId) ||
    row.visaListingId ||
    '';
  const travellers = Array.isArray(row.travellers)
    ? row.travellers
    : Array.isArray(wizard.travellers)
      ? wizard.travellers
      : [];

  return {
    version: typeof wizard.version === 'number' ? wizard.version : 1,
    updatedAt: row.updatedAt.toISOString(),
    countryCode,
    countryName:
      (typeof wizard.countryName === 'string' && wizard.countryName) || '',
    listingId,
    processName:
      (typeof wizard.processName === 'string' && wizard.processName) || '',
    step: (typeof wizard.step === 'string' && wizard.step) || 'form',
    primaryName:
      row.applicantName ||
      (typeof wizard.primaryName === 'string' && wizard.primaryName) ||
      '',
    travellers,
    departure: row.travelInfo ?? wizard.departure ?? {},
    travellersCount:
      typeof wizard.travellersCount === 'number'
        ? wizard.travellersCount
        : Math.max(1, travellers.length),
    interestedInInsurance:
      typeof wizard.interestedInInsurance === 'boolean'
        ? wizard.interestedInInsurance
        : row.interestedInInsurance,
  };
}

async function upsertDraftApplication(input: {
  ownerUserId: string;
  savedByUserId: string;
  listingId: string;
  countryCode?: string;
  payload: unknown;
}): Promise<DraftSaveSuccess | { success: false; error: string }> {
  const validated = parseServerDraftPayload(input.payload);
  if (!validated.success) {
    return { success: false, error: validated.error };
  }

  const payload = validated.data;
  if (payload.listingId !== input.listingId) {
    return { success: false, error: 'Draft listing mismatch' };
  }

  const [listing] = await db
    .select({
      id: visaListings.id,
      destinationCountry: visaListings.destinationCountry,
      processTypeLabel: visaListings.processTypeLabel,
      processType: visaListings.processType,
      purpose: visaListings.purpose,
      processName: visaListings.processName,
    })
    .from(visaListings)
    .where(eq(visaListings.id, input.listingId))
    .limit(1);

  if (!listing) {
    return { success: false, error: 'Visa listing not found' };
  }

  const countryCode = (
    input.countryCode ||
    payload.countryCode ||
    listing.destinationCountry ||
    ''
  )
    .trim()
    .toUpperCase()
    .slice(0, 2);

  const [country] = countryCode
    ? await db
        .select({ name: countries.name })
        .from(countries)
        .where(eq(countries.iso2Code, countryCode))
        .limit(1)
    : [null];

  const resolvedVisaType = String(
    listing.processTypeLabel ||
      listing.processType ||
      listing.purpose ||
      listing.processName ||
      payload.processName ||
      'visa'
  ).slice(0, 100);

  const now = new Date();
  const primaryName = (payload.primaryName || 'Applicant').slice(0, 255);
  const passengerNames = Array.isArray(payload.travellers)
    ? payload.travellers
        .map((t) => {
          if (!t || typeof t !== 'object') return '';
          return String((t as { name?: string }).name || '')
            .trim()
            .toLowerCase();
        })
        .filter(Boolean)
        .join(' ')
    : '';

  const personalInfo = {
    wizardDraft: payload,
    primaryName,
    interestedInInsurance: payload.interestedInInsurance ?? false,
  };

  const [existing] = await db
    .select({
      id: visaApplications.id,
      referenceNumber: visaApplications.referenceNumber,
      status: visaApplications.status,
    })
    .from(visaApplications)
    .where(
      and(
        eq(visaApplications.userId, input.ownerUserId),
        eq(visaApplications.visaListingId, input.listingId),
        eq(visaApplications.status, 'draft')
      )
    )
    .limit(1);

  try {
    if (existing) {
      const [row] = await db
        .update(visaApplications)
        .set({
          countryCode: countryCode || null,
          country: country?.name ?? null,
          visaType: resolvedVisaType,
          travellers: payload.travellers,
          travelInfo: payload.departure,
          personalInfo,
          applicantName: primaryName,
          passengerNames,
          interestedInInsurance: payload.interestedInInsurance ?? false,
          savedByUserId: input.savedByUserId,
          documents: collectDocumentRefs(payload.travellers),
          updatedAt: now,
        })
        .where(eq(visaApplications.id, existing.id))
        .returning({
          id: visaApplications.id,
          referenceNumber: visaApplications.referenceNumber,
          updatedAt: visaApplications.updatedAt,
        });

      return {
        success: true,
        updatedAt: row.updatedAt.toISOString(),
        applicationId: row.id,
        referenceNumber: row.referenceNumber,
      };
    }

    const referenceNumber = await ensureUniqueVisaReferenceNumber(db);
    const [row] = await db
      .insert(visaApplications)
      .values({
        userId: input.ownerUserId,
        referenceNumber,
        countryCode: countryCode || null,
        visaListingId: input.listingId,
        country: country?.name ?? null,
        visaType: resolvedVisaType,
        status: 'draft',
        travellers: payload.travellers,
        travelInfo: payload.departure,
        personalInfo,
        applicantName: primaryName,
        passengerNames,
        interestedInInsurance: payload.interestedInInsurance ?? false,
        savedByUserId: input.savedByUserId,
        documents: collectDocumentRefs(payload.travellers),
        updatedAt: now,
      })
      .returning({
        id: visaApplications.id,
        referenceNumber: visaApplications.referenceNumber,
        updatedAt: visaApplications.updatedAt,
      });

    return {
      success: true,
      updatedAt: row.updatedAt.toISOString(),
      applicationId: row.id,
      referenceNumber: row.referenceNumber,
    };
  } catch (error) {
    console.error('upsertDraftApplication error:', error);
    return {
      success: false,
      error: 'Could not save your application draft. Try again.',
    };
  }
}

function collectDocumentRefs(travellers: unknown): Array<{
  key: string;
  url?: string;
  slotKey: string;
  passengerId: string;
}> {
  if (!Array.isArray(travellers)) return [];
  const refs: Array<{
    key: string;
    url?: string;
    slotKey: string;
    passengerId: string;
  }> = [];

  for (const traveller of travellers) {
    if (!traveller || typeof traveller !== 'object') continue;
    const t = traveller as {
      id?: string;
      draftFileRefs?: Array<{
        slotKey?: string;
        storageKey?: string;
        url?: string;
      }>;
      documents?: Array<{
        key?: string;
        storageKey?: string;
        storageUrl?: string;
      }>;
    };
    const passengerId = t.id || '';
    for (const ref of t.draftFileRefs ?? []) {
      if (ref.storageKey && ref.slotKey) {
        refs.push({
          key: ref.storageKey,
          url: ref.url,
          slotKey: ref.slotKey,
          passengerId,
        });
      }
    }
    for (const doc of t.documents ?? []) {
      if (doc.storageKey && doc.key) {
        refs.push({
          key: doc.storageKey,
          url: doc.storageUrl,
          slotKey: doc.key,
          passengerId,
        });
      }
    }
  }
  return refs;
}

async function deleteDraftApplicationAndFiles(input: {
  id: string;
  travellers: unknown;
  documents: unknown;
}): Promise<void> {
  await deleteDraftStorageFiles({
    travellers: input.travellers,
  });

  // Also wipe any documents table rows + leftover keys on the application.
  const docRows = await db
    .select({ s3Key: documents.s3Key })
    .from(documents)
    .where(
      and(
        eq(documents.applicationId, input.id),
        eq(documents.applicationType, 'visa')
      )
    );

  for (const row of docRows) {
    try {
      await uploadService.delete({ key: assertSafeStorageKey(row.s3Key) });
    } catch (error) {
      console.warn('[Draft] Failed to delete document key:', row.s3Key, error);
    }
  }

  await db
    .delete(documents)
    .where(
      and(
        eq(documents.applicationId, input.id),
        eq(documents.applicationType, 'visa')
      )
    );

  await db.delete(visaApplications).where(eq(visaApplications.id, input.id));
}

async function findDraftForUser(listingId: string, ownerUserId: string) {
  const [row] = await db
    .select({
      id: visaApplications.id,
      visaListingId: visaApplications.visaListingId,
      countryCode: visaApplications.countryCode,
      applicantName: visaApplications.applicantName,
      travellers: visaApplications.travellers,
      travelInfo: visaApplications.travelInfo,
      personalInfo: visaApplications.personalInfo,
      interestedInInsurance: visaApplications.interestedInInsurance,
      referenceNumber: visaApplications.referenceNumber,
      updatedAt: visaApplications.updatedAt,
    })
    .from(visaApplications)
    .where(
      and(
        eq(visaApplications.userId, ownerUserId),
        eq(visaApplications.visaListingId, listingId),
        eq(visaApplications.status, 'draft')
      )
    )
    .limit(1);

  return row ?? null;
}

/**
 * Bump updatedAt when the user resumes a draft (Continue / ?resume=1).
 * Does not change payload — only the row timestamp for dashboard/admin sorting.
 */
export async function touchVisaDraftApplication(input: {
  listingId: string;
  /** Staff on-behalf: applicant user id. Defaults to signed-in user. */
  ownerUserId?: string | null;
}): Promise<
  | { success: true; updatedAt: string; applicationId: string }
  | { success: false; error: string }
> {
  const authResult = await requireSessionUserId();
  if (!authResult.ok) {
    return { success: false, error: authResult.error };
  }

  let ownerUserId = authResult.userId;
  if (input.ownerUserId && input.ownerUserId !== authResult.userId) {
    if (!canAccessAdmin({ role: authResult.role })) {
      return { success: false, error: 'Not allowed' };
    }
    ownerUserId = input.ownerUserId;
  }

  const now = new Date();
  const [row] = await db
    .update(visaApplications)
    .set({ updatedAt: now })
    .where(
      and(
        eq(visaApplications.userId, ownerUserId),
        eq(visaApplications.visaListingId, input.listingId),
        eq(visaApplications.status, 'draft')
      )
    )
    .returning({
      id: visaApplications.id,
      updatedAt: visaApplications.updatedAt,
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

export async function getApplicationDraft(listingId: string): Promise<
  | {
      success: true;
      draft: {
        payload: ServerDraftPayload;
        updatedAt: string;
        applicationId: string;
        referenceNumber: string;
      } | null;
    }
  | { success: false; error: string }
> {
  const authResult = await requireSessionUserId();
  if (!authResult.ok) {
    return { success: false, error: authResult.error };
  }

  const row = await findDraftForUser(listingId, authResult.userId);
  if (!row) {
    return { success: true, draft: null };
  }

  return {
    success: true,
    draft: {
      payload: buildPayloadFromRow(row),
      updatedAt: row.updatedAt.toISOString(),
      applicationId: row.id,
      referenceNumber: row.referenceNumber,
    },
  };
}

/** Staff: load a draft owned by a specific applicant. */
export async function getApplicationDraftForUser(
  listingId: string,
  targetUserId: string
): Promise<
  | {
      success: true;
      draft: {
        payload: ServerDraftPayload;
        updatedAt: string;
        applicationId: string;
        referenceNumber: string;
      } | null;
    }
  | { success: false; error: string }
> {
  const authResult = await requireSessionUserId();
  if (!authResult.ok) {
    return { success: false, error: authResult.error };
  }
  if (!canAccessAdmin({ role: authResult.role })) {
    return { success: false, error: 'Not allowed' };
  }

  const row = await findDraftForUser(listingId, targetUserId);
  if (!row) {
    return { success: true, draft: null };
  }

  return {
    success: true,
    draft: {
      payload: buildPayloadFromRow(row),
      updatedAt: row.updatedAt.toISOString(),
      applicationId: row.id,
      referenceNumber: row.referenceNumber,
    },
  };
}

/** Save a draft owned by the signed-in user (applicant, admin, or reviewer). */
export async function upsertApplicationDraft(input: {
  listingId: string;
  countryCode?: string;
  payload: ServerDraftPayload;
}): Promise<DraftSaveSuccess | { success: false; error: string }> {
  const authResult = await requireSessionUserId();
  if (!authResult.ok) {
    return { success: false, error: authResult.error };
  }

  return upsertDraftApplication({
    ownerUserId: authResult.userId,
    savedByUserId: authResult.userId,
    listingId: input.listingId,
    countryCode: input.countryCode,
    payload: input.payload,
  });
}

export async function upsertApplicationDraftForUser(input: {
  listingId: string;
  targetUserId: string;
  countryCode?: string;
  payload: ServerDraftPayload;
}): Promise<DraftSaveSuccess | { success: false; error: string }> {
  const authResult = await requireSessionUserId();
  if (!authResult.ok) {
    return { success: false, error: authResult.error };
  }
  if (!canAccessAdmin({ role: authResult.role })) {
    return { success: false, error: 'Not allowed' };
  }

  const [target] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, input.targetUserId))
    .limit(1);

  if (!target) {
    return { success: false, error: 'Applicant not found' };
  }
  if (target.role === 'admin' || target.role === 'reviewer') {
    return {
      success: false,
      error: 'Drafts can only be saved for applicant accounts.',
    };
  }

  return upsertDraftApplication({
    ownerUserId: input.targetUserId,
    savedByUserId: authResult.userId,
    listingId: input.listingId,
    countryCode: input.countryCode,
    payload: input.payload,
  });
}

export async function listMyApplicationDrafts(): Promise<
  | {
      success: true;
      drafts: Array<{
        id: string;
        listingId: string;
        listingSlug: string | null;
        countryCode: string | null;
        referenceNumber: string;
        updatedAt: string;
        payload: ServerDraftPayload;
        kind: 'visa' | 'passport';
      }>;
    }
  | { success: false; error: string }
> {
  const authResult = await requireSessionUserId();
  if (!authResult.ok) {
    return { success: false, error: authResult.error };
  }

  const rows = await db
    .select({
      id: visaApplications.id,
      listingId: visaApplications.visaListingId,
      listingSlug: visaListings.slug,
      countryCode: visaApplications.countryCode,
      referenceNumber: visaApplications.referenceNumber,
      updatedAt: visaApplications.updatedAt,
      applicantName: visaApplications.applicantName,
      travellers: visaApplications.travellers,
      travelInfo: visaApplications.travelInfo,
      personalInfo: visaApplications.personalInfo,
      interestedInInsurance: visaApplications.interestedInInsurance,
    })
    .from(visaApplications)
    .leftJoin(
      visaListings,
      eq(visaApplications.visaListingId, visaListings.id)
    )
    .where(
      and(
        eq(visaApplications.userId, authResult.userId),
        eq(visaApplications.status, 'draft')
      )
    )
    .orderBy(desc(visaApplications.updatedAt));

  return {
    success: true,
    drafts: rows
      .filter((row) => Boolean(row.listingId))
      .map((row) => ({
        id: row.id,
        listingId: row.listingId as string,
        listingSlug: row.listingSlug,
        countryCode: row.countryCode,
        referenceNumber: row.referenceNumber,
        updatedAt: row.updatedAt.toISOString(),
        kind: 'visa' as const,
        payload: buildPayloadFromRow({
          id: row.id,
          visaListingId: row.listingId,
          countryCode: row.countryCode,
          applicantName: row.applicantName,
          travellers: row.travellers,
          travelInfo: row.travelInfo,
          personalInfo: row.personalInfo,
          interestedInInsurance: row.interestedInInsurance,
          updatedAt: row.updatedAt,
        }),
      })),
  };
}

export async function listAdminApplicationDrafts(input?: {
  search?: string;
  limit?: number;
}): Promise<
  { success: true; drafts: ApplicationDraftListItem[] } | { success: false; error: string }
> {
  const authResult = await requireSessionUserId();
  if (!authResult.ok) {
    return { success: false, error: authResult.error };
  }
  if (!canAccessAdmin({ role: authResult.role })) {
    return { success: false, error: 'Not allowed' };
  }

  const savedBy = alias(users, 'draft_saved_by');
  const search = input?.search?.trim();
  const limit = Math.min(100, Math.max(1, input?.limit ?? 50));

  const conditions = and(
    eq(visaApplications.status, 'draft'),
    search
      ? or(
          ilike(users.name, `%${search}%`),
          ilike(users.email, `%${search}%`),
          ilike(users.phone, `%${search}%`),
          ilike(visaApplications.applicantName, `%${search}%`),
          ilike(visaApplications.referenceNumber, `%${search}%`),
          ilike(
            sql`(${visaApplications.personalInfo}->'wizardDraft'->>'processName')`,
            `%${search}%`
          ),
          ilike(
            sql`(${visaApplications.personalInfo}->'wizardDraft'->>'countryName')`,
            `%${search}%`
          )
        )
      : undefined
  );

  const rows = await db
    .select({
      id: visaApplications.id,
      listingId: visaApplications.visaListingId,
      listingSlug: visaListings.slug,
      countryCode: visaApplications.countryCode,
      referenceNumber: visaApplications.referenceNumber,
      updatedAt: visaApplications.updatedAt,
      createdAt: visaApplications.createdAt,
      applicantName: visaApplications.applicantName,
      travellers: visaApplications.travellers,
      travelInfo: visaApplications.travelInfo,
      personalInfo: visaApplications.personalInfo,
      interestedInInsurance: visaApplications.interestedInInsurance,
      userId: users.id,
      userName: users.name,
      userEmail: users.email,
      userPhone: users.phone,
      userRole: users.role,
      savedById: savedBy.id,
      savedByName: savedBy.name,
      savedByRole: savedBy.role,
    })
    .from(visaApplications)
    .innerJoin(users, eq(visaApplications.userId, users.id))
    .leftJoin(
      visaListings,
      eq(visaApplications.visaListingId, visaListings.id)
    )
    .leftJoin(savedBy, eq(visaApplications.savedByUserId, savedBy.id))
    .where(conditions)
    .orderBy(desc(visaApplications.updatedAt))
    .limit(limit);

  return {
    success: true,
    drafts: rows
      .filter((row) => Boolean(row.listingId))
      .map((row) => ({
        id: row.id,
        listingId: row.listingId as string,
        listingSlug: row.listingSlug,
        countryCode: row.countryCode,
        referenceNumber: row.referenceNumber,
        updatedAt: row.updatedAt.toISOString(),
        createdAt: row.createdAt.toISOString(),
        payload: buildPayloadFromRow({
          id: row.id,
          visaListingId: row.listingId,
          countryCode: row.countryCode,
          applicantName: row.applicantName,
          travellers: row.travellers,
          travelInfo: row.travelInfo,
          personalInfo: row.personalInfo,
          interestedInInsurance: row.interestedInInsurance,
          updatedAt: row.updatedAt,
        }),
        user: {
          id: row.userId,
          name: row.userName,
          email: row.userEmail,
          phone: row.userPhone,
          role: row.userRole || 'user',
        },
        savedBy: row.savedById
          ? {
              id: row.savedById,
              name: row.savedByName || 'Staff',
              role: row.savedByRole || 'user',
            }
          : null,
      })),
  };
}

/** Delete a draft owned by the signed-in user (any role). */
export async function deleteApplicationDraft(
  listingId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const authResult = await requireSessionUserId();
  if (!authResult.ok) {
    return { success: false, error: authResult.error };
  }

  try {
    const [row] = await db
      .select({
        id: visaApplications.id,
        travellers: visaApplications.travellers,
        documents: visaApplications.documents,
      })
      .from(visaApplications)
      .where(
        and(
          eq(visaApplications.userId, authResult.userId),
          eq(visaApplications.visaListingId, listingId),
          eq(visaApplications.status, 'draft')
        )
      )
      .limit(1);

    if (row) {
      await deleteDraftApplicationAndFiles(row);
    }
    return { success: true };
  } catch (error) {
    console.error('deleteApplicationDraft error:', error);
    return { success: false, error: 'Could not discard draft' };
  }
}

export async function deleteApplicationDraftAsAdmin(
  draftId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const authResult = await requireSessionUserId();
  if (!authResult.ok) {
    return { success: false, error: authResult.error };
  }
  if (!canAccessAdmin({ role: authResult.role })) {
    return { success: false, error: 'Not allowed' };
  }

  try {
    const [row] = await db
      .select({
        id: visaApplications.id,
        travellers: visaApplications.travellers,
        documents: visaApplications.documents,
        status: visaApplications.status,
      })
      .from(visaApplications)
      .where(eq(visaApplications.id, draftId))
      .limit(1);

    if (row && row.status === 'draft') {
      await deleteDraftApplicationAndFiles(row);
    }
    return { success: true };
  } catch (error) {
    console.error('deleteApplicationDraftAsAdmin error:', error);
    return { success: false, error: 'Could not discard draft' };
  }
}

/** Resolve a user label for the on-behalf banner (staff only). */
export async function getApplicantSummaryForDraft(userId: string): Promise<
  | {
      success: true;
      user: { id: string; name: string; phone: string | null; email: string };
    }
  | { success: false; error: string }
> {
  const authResult = await requireSessionUserId();
  if (!authResult.ok) {
    return { success: false, error: authResult.error };
  }
  if (!canAccessAdmin({ role: authResult.role })) {
    return { success: false, error: 'Not allowed' };
  }

  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      phone: users.phone,
      email: users.email,
      role: users.role,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user || user.role === 'admin' || user.role === 'reviewer') {
    return { success: false, error: 'Applicant not found' };
  }

  return {
    success: true,
    user: {
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
    },
  };
}
