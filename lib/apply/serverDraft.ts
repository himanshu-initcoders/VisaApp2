/**
 * Application draft sync (JSON only) after applicant OTP login.
 */

'use server';

import { and, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { applicationDrafts } from '@/lib/db/schema';

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
}

export async function getApplicationDraft(listingId: string): Promise<{
  success: true;
  draft: { payload: ServerDraftPayload; updatedAt: string } | null;
} | { success: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Not signed in' };
  }

  const [row] = await db
    .select()
    .from(applicationDrafts)
    .where(
      and(
        eq(applicationDrafts.userId, session.user.id),
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

export async function upsertApplicationDraft(input: {
  listingId: string;
  countryCode?: string;
  payload: ServerDraftPayload;
}): Promise<{ success: true; updatedAt: string } | { success: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Not signed in' };
  }

  const now = new Date();
  const [existing] = await db
    .select({ id: applicationDrafts.id })
    .from(applicationDrafts)
    .where(
      and(
        eq(applicationDrafts.userId, session.user.id),
        eq(applicationDrafts.listingId, input.listingId)
      )
    )
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(applicationDrafts)
      .set({
        payload: input.payload,
        countryCode: input.countryCode ?? null,
        updatedAt: now,
      })
      .where(eq(applicationDrafts.id, existing.id))
      .returning({ updatedAt: applicationDrafts.updatedAt });

    return { success: true, updatedAt: updated.updatedAt.toISOString() };
  }

  const [created] = await db
    .insert(applicationDrafts)
    .values({
      userId: session.user.id,
      listingId: input.listingId,
      countryCode: input.countryCode ?? null,
      payload: input.payload,
      updatedAt: now,
    })
    .returning({ updatedAt: applicationDrafts.updatedAt });

  return { success: true, updatedAt: created.updatedAt.toISOString() };
}
