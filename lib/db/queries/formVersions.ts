import { db } from '@/lib/db';
import { formVersions } from '@/lib/db/schema';
import { eq, desc, max } from 'drizzle-orm';
import { getProcessWithAllRelations } from '@/lib/db/queries/config';
import { buildApplyFormConfig } from '@/lib/apply/applicationForm';

export async function getLatestPublishedFormVersion(listingId: string) {
  const rows = await db
    .select()
    .from(formVersions)
    .where(eq(formVersions.listingId, listingId))
    .orderBy(desc(formVersions.version))
    .limit(1);

  return rows[0] ?? null;
}

export async function getNextFormVersionNumber(listingId: string): Promise<number> {
  const result = await db
    .select({ maxVersion: max(formVersions.version) })
    .from(formVersions)
    .where(eq(formVersions.listingId, listingId));

  return (result[0]?.maxVersion ?? 0) + 1;
}

/**
 * Ensure a published form version exists for submit.
 * If admin never clicked Publish, freeze the live listing config as v1
 * so applicants are not blocked.
 */
export async function ensureFormVersionForSubmit(
  listingId: string,
  publishedBy?: string | null
) {
  const existing = await getLatestPublishedFormVersion(listingId);
  if (existing) return existing;

  const process = await getProcessWithAllRelations(listingId);
  if (!process) {
    return null;
  }

  const config = buildApplyFormConfig({
    purpose: process.purpose,
    countryName: process.country.name,
    processName: process.processName,
    showGeneralInfo: process.showGeneralInfo,
    showTripDetails: process.showTripDetails,
    components: process.componentsRequired,
    questions: process.additionalQuestions,
  });

  const version = await getNextFormVersionNumber(listingId);

  try {
    const [created] = await db
      .insert(formVersions)
      .values({
        listingId,
        version,
        config,
        publishedBy: publishedBy ?? null,
        publishedAt: new Date(),
      })
      .returning();

    return created;
  } catch {
    // Race: another submit published first — re-read
    return getLatestPublishedFormVersion(listingId);
  }
}
