'use server';

import { and, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { resolveSessionUserId } from '@/lib/auth/session-user';
import { db } from '@/lib/db';
import { passportApplicationDrafts } from '@/lib/db/schema';

export async function savePassportDraft(input: {
  listingId: string;
  payload: unknown;
}) {
  const session = await auth();
  const userId = session?.user
    ? await resolveSessionUserId(session.user)
    : null;
  if (!userId) return { success: false as const, error: 'Sign in to save.' };

  const existing = await db.query.passportApplicationDrafts.findFirst({
    where: and(
      eq(passportApplicationDrafts.userId, userId),
      eq(passportApplicationDrafts.passportListingId, input.listingId)
    ),
  });

  if (existing) {
    await db
      .update(passportApplicationDrafts)
      .set({
        payload: input.payload as object,
        savedByUserId: userId,
        updatedAt: new Date(),
      })
      .where(eq(passportApplicationDrafts.id, existing.id));
  } else {
    await db.insert(passportApplicationDrafts).values({
      userId,
      passportListingId: input.listingId,
      payload: input.payload as object,
      savedByUserId: userId,
    });
  }

  return { success: true as const };
}

export async function loadPassportDraft(listingId: string) {
  const session = await auth();
  const userId = session?.user
    ? await resolveSessionUserId(session.user)
    : null;
  if (!userId) return { success: false as const, draft: null };

  const existing = await db.query.passportApplicationDrafts.findFirst({
    where: and(
      eq(passportApplicationDrafts.userId, userId),
      eq(passportApplicationDrafts.passportListingId, listingId)
    ),
  });

  return {
    success: true as const,
    draft: (existing?.payload as Record<string, unknown>) ?? null,
  };
}
