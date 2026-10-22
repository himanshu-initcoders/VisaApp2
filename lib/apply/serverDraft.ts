/**
 * Application draft sync (JSON only). Files stay in IndexedDB until submit.
 */

'use server';

import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { auth } from '@/lib/auth';
import { resolveSessionUserId } from '@/lib/auth/session-user';
import { canAccessAdmin } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import { applicationDrafts, users } from '@/lib/db/schema';
import { deleteDraftStorageFiles } from '@/lib/apply/deleteDraftStorageFiles';
import { parseServerDraftPayload } from '@/lib/validations/draft';

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
  countryCode: string | null;
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

async function upsertDraftRow(input: {
  ownerUserId: string;
  savedByUserId: string;
  listingId: string;
  countryCode?: string;
  payload: unknown;
}): Promise<{ success: true; updatedAt: string } | { success: false; error: string }> {
  const validated = parseServerDraftPayload(input.payload);
  if (!validated.success) {
    return { success: false, error: validated.error };
  }

  const payload = validated.data;
  if (payload.listingId !== input.listingId) {
    return { success: false, error: 'Draft listing mismatch' };
  }

  const now = new Date();

  try {
    const [row] = await db
      .insert(applicationDrafts)
      .values({
        userId: input.ownerUserId,
        listingId: input.listingId,
        countryCode: input.countryCode ?? payload.countryCode ?? null,
        payload,
        savedByUserId: input.savedByUserId,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [applicationDrafts.userId, applicationDrafts.listingId],
        set: {
          payload,
          countryCode: input.countryCode ?? payload.countryCode ?? null,
          savedByUserId: input.savedByUserId,
          updatedAt: now,
        },
      })
      .returning({ updatedAt: applicationDrafts.updatedAt });

    return { success: true, updatedAt: row.updatedAt.toISOString() };
  } catch (error) {
    console.error('upsertDraftRow error:', error);
    return {
      success: false,
      error: 'Could not save your application draft. Try again.',
    };
  }
}

async function deleteDraftRowAndFiles(
  condition: ReturnType<typeof and>
): Promise<void> {
  if (!condition) return;
  const where = condition;

  const rows = await db
    .select({ payload: applicationDrafts.payload })
    .from(applicationDrafts)
    .where(where);

  for (const row of rows) {
    await deleteDraftStorageFiles(row.payload);
  }

  if (rows.length > 0) {
    await db.delete(applicationDrafts).where(where);
  }
}

export async function getApplicationDraft(listingId: string): Promise<
  | {
      success: true;
      draft: { payload: ServerDraftPayload; updatedAt: string } | null;
    }
  | { success: false; error: string }
> {
  const authResult = await requireSessionUserId();
  if (!authResult.ok) {
    return { success: false, error: authResult.error };
  }

  const [row] = await db
    .select()
    .from(applicationDrafts)
    .where(
      and(
        eq(applicationDrafts.userId, authResult.userId),
        eq(applicationDrafts.listingId, listingId)
      )
    )
    .limit(1);

  if (!row) {
    return { success: true, draft: null };
  }

  return {
    success: true,
    draft: {
      payload: row.payload as ServerDraftPayload,
      updatedAt: row.updatedAt.toISOString(),
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
      draft: { payload: ServerDraftPayload; updatedAt: string } | null;
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

  const [row] = await db
    .select()
    .from(applicationDrafts)
    .where(
      and(
        eq(applicationDrafts.userId, targetUserId),
        eq(applicationDrafts.listingId, listingId)
      )
    )
    .limit(1);

  if (!row) {
    return { success: true, draft: null };
  }

  return {
    success: true,
    draft: {
      payload: row.payload as ServerDraftPayload,
      updatedAt: row.updatedAt.toISOString(),
    },
  };
}

/** Save a draft owned by the signed-in user (applicant, admin, or reviewer). */
export async function upsertApplicationDraft(input: {
  listingId: string;
  countryCode?: string;
  payload: ServerDraftPayload;
}): Promise<{ success: true; updatedAt: string } | { success: false; error: string }> {
  const authResult = await requireSessionUserId();
  if (!authResult.ok) {
    return { success: false, error: authResult.error };
  }

  return upsertDraftRow({
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
}): Promise<{ success: true; updatedAt: string } | { success: false; error: string }> {
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

  return upsertDraftRow({
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
        countryCode: string | null;
        updatedAt: string;
        payload: ServerDraftPayload;
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
      id: applicationDrafts.id,
      listingId: applicationDrafts.listingId,
      countryCode: applicationDrafts.countryCode,
      updatedAt: applicationDrafts.updatedAt,
      payload: applicationDrafts.payload,
    })
    .from(applicationDrafts)
    .where(eq(applicationDrafts.userId, authResult.userId))
    .orderBy(desc(applicationDrafts.updatedAt));

  return {
    success: true,
    drafts: rows.map((row) => ({
      id: row.id,
      listingId: row.listingId,
      countryCode: row.countryCode,
      updatedAt: row.updatedAt.toISOString(),
      payload: row.payload as ServerDraftPayload,
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

  const conditions = search
    ? or(
        ilike(users.name, `%${search}%`),
        ilike(users.email, `%${search}%`),
        ilike(users.phone, `%${search}%`),
        ilike(sql`(${applicationDrafts.payload}->>'processName')`, `%${search}%`),
        ilike(sql`(${applicationDrafts.payload}->>'countryName')`, `%${search}%`)
      )
    : undefined;

  const rows = await db
    .select({
      id: applicationDrafts.id,
      listingId: applicationDrafts.listingId,
      countryCode: applicationDrafts.countryCode,
      updatedAt: applicationDrafts.updatedAt,
      createdAt: applicationDrafts.createdAt,
      payload: applicationDrafts.payload,
      userId: users.id,
      userName: users.name,
      userEmail: users.email,
      userPhone: users.phone,
      userRole: users.role,
      savedById: savedBy.id,
      savedByName: savedBy.name,
      savedByRole: savedBy.role,
    })
    .from(applicationDrafts)
    .innerJoin(users, eq(applicationDrafts.userId, users.id))
    .leftJoin(savedBy, eq(applicationDrafts.savedByUserId, savedBy.id))
    .where(conditions)
    .orderBy(desc(applicationDrafts.updatedAt))
    .limit(limit);

  return {
    success: true,
    drafts: rows.map((row) => ({
      id: row.id,
      listingId: row.listingId,
      countryCode: row.countryCode,
      updatedAt: row.updatedAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      payload: row.payload as ServerDraftPayload,
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
    await deleteDraftRowAndFiles(
      and(
        eq(applicationDrafts.userId, authResult.userId),
        eq(applicationDrafts.listingId, listingId)
      )
    );
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
    await deleteDraftRowAndFiles(and(eq(applicationDrafts.id, draftId)));
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
