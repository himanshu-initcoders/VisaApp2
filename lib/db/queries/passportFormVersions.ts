import { db } from '@/lib/db';
import { passportFormVersions } from '@/lib/db/schema';
import {
  getDocumentTypeSamplesByValues,
} from '@/lib/db/queries/config';
import {
  getLatestPassportFormVersion,
  getNextPassportFormVersionNumber,
  getPassportListingWithAllRelations,
} from '@/lib/db/queries/passport-config';
import { buildPassportFormConfig } from '@/lib/apply/passportForm';

export async function ensurePassportFormVersionForSubmit(
  listingId: string,
  publishedBy?: string | null
) {
  const existing = await getLatestPassportFormVersion(listingId);
  if (existing) return existing;

  const listing = await getPassportListingWithAllRelations(listingId);
  if (!listing) return null;

  const documentTypeSamples = await getDocumentTypeSamplesByValues(
    listing.componentsRequired.flatMap((item) =>
      [item.documentType, item.key].filter(Boolean) as string[]
    )
  );

  const config = buildPassportFormConfig({
    listing,
    formSteps: listing.formSteps,
    components: listing.componentsRequired,
    documentTypeSamples,
  });

  const version = await getNextPassportFormVersionNumber(listingId);

  try {
    const [created] = await db
      .insert(passportFormVersions)
      .values({
        passportListingId: listingId,
        version,
        config,
        publishedBy: publishedBy || null,
        publishedAt: new Date(),
      })
      .returning();
    return created;
  } catch {
    return getLatestPassportFormVersion(listingId);
  }
}
