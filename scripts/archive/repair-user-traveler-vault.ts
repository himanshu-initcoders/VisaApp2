/**
 * Repair mixed traveler vault ownership + thin submitted JSON for a user.
 *
 * - Unlinks documents from a traveler_profile when the source application
 *   traveller identity does not match that profile's npd key.
 * - Rebuilds travellers[].documents for a thin submitted app from a richer
 *   prior app of the same traveler (same npd identity).
 *
 * Run:
 *   npx tsx --tsconfig tsconfig.json scripts/repair-user-traveler-vault.ts
 */

import { config } from 'dotenv';
config({ path: '.env' });

import { and, eq, ne } from 'drizzle-orm';
import { db } from '@/lib/db';
import { documents, visaApplications } from '@/lib/db/schema';
import { travelerProfiles } from '@/lib/db/schema-traveler-profiles';
import { travelerProfileKey } from '@/lib/dashboard/travelerIdentity';
import { extractApplicationIdFromObjectKey } from '@/lib/upload/applicationKey';

const USER_ID = 'a2d17cde-2145-4279-93e4-1d80e9723f2c';
const THIN_APP_REF = 'VI099553467380';
const RICH_APP_REF = 'VI604090195083';

type TravellerDoc = {
  documentId?: string;
  key?: string;
  url?: string;
  size?: number;
  slotKey?: string;
  filename?: string;
  mimeType?: string;
};

type Traveller = {
  passengerId?: string;
  name?: string;
  passportData?: Record<string, unknown> | null;
  documents?: TravellerDoc[] | null;
  [key: string]: unknown;
};

async function unlinkMismatchedVaultDocs() {
  const profiles = await db
    .select()
    .from(travelerProfiles)
    .where(eq(travelerProfiles.userId, USER_ID));

  const apps = await db
    .select({
      id: visaApplications.id,
      travellers: visaApplications.travellers,
      status: visaApplications.status,
    })
    .from(visaApplications)
    .where(
      and(
        eq(visaApplications.userId, USER_ID),
        ne(visaApplications.status, 'draft')
      )
    );

  const appIdentity = new Map<string, string | null>();
  for (const app of apps) {
    const travellers = Array.isArray(app.travellers)
      ? (app.travellers as Traveller[])
      : [];
    const first = travellers[0];
    appIdentity.set(
      app.id,
      first
        ? travelerProfileKey({
            passengerId: first.passengerId,
            name: first.name,
            passportData: first.passportData ?? null,
          })
        : null
    );
  }

  let unlinked = 0;
  for (const profile of profiles) {
    const rows = await db
      .select()
      .from(documents)
      .where(eq(documents.profileId, profile.id));

    for (const row of rows) {
      const appId = extractApplicationIdFromObjectKey(row.s3Key);
      if (!appId) continue;
      const identity = appIdentity.get(appId);
      if (!identity) continue;
      if (identity === profile.identityKey) continue;

      await db
        .update(documents)
        .set({ profileId: null })
        .where(eq(documents.id, row.id));
      unlinked += 1;
    }
  }

  return unlinked;
}

async function repairThinSubmittedApp() {
  const [thin] = await db
    .select()
    .from(visaApplications)
    .where(eq(visaApplications.referenceNumber, THIN_APP_REF))
    .limit(1);
  const [rich] = await db
    .select()
    .from(visaApplications)
    .where(eq(visaApplications.referenceNumber, RICH_APP_REF))
    .limit(1);

  if (!thin || !rich || thin.userId !== USER_ID || rich.userId !== USER_ID) {
    return { repaired: false, reason: 'apps not found' };
  }

  const thinTravellers = Array.isArray(thin.travellers)
    ? ([...(thin.travellers as Traveller[])] as Traveller[])
    : [];
  const richTravellers = Array.isArray(rich.travellers)
    ? (rich.travellers as Traveller[])
    : [];

  const thinT = thinTravellers[0];
  const richT = richTravellers[0];
  if (!thinT || !richT) return { repaired: false, reason: 'no travellers' };

  const thinDocs = Array.isArray(thinT.documents) ? thinT.documents : [];
  const richDocs = Array.isArray(richT.documents) ? richT.documents : [];
  if (thinDocs.length >= richDocs.length) {
    return {
      repaired: false,
      reason: `thin already has ${thinDocs.length} docs`,
    };
  }

  // Keep thin passport identity; merge missing slots from rich by slotKey.
  const bySlot = new Map<string, TravellerDoc>();
  for (const doc of richDocs) {
    if (doc?.slotKey) bySlot.set(doc.slotKey, doc);
  }
  for (const doc of thinDocs) {
    if (doc?.slotKey) bySlot.set(doc.slotKey, doc);
  }

  thinT.documents = Array.from(bySlot.values());
  thinTravellers[0] = thinT;

  await db
    .update(visaApplications)
    .set({
      travellers: thinTravellers,
      documents: thinT.documents,
      updatedAt: new Date(),
    })
    .where(eq(visaApplications.id, thin.id));

  return {
    repaired: true,
    before: thinDocs.length,
    after: thinT.documents.length,
  };
}

async function main() {
  const unlinked = await unlinkMismatchedVaultDocs();
  const repair = await repairThinSubmittedApp();
  console.log(JSON.stringify({ unlinked, repair }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
