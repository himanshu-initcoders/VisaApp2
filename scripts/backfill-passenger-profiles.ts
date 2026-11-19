/**
 * ONE-OFF backfill (not a product runtime step).
 * Copy also lives under scripts/archive/.
 *
 * Idempotent backfill: traveler_profiles + vault ownership on visa documents.
 * Run: npm run db:backfill-passenger-profiles
 */

import { config } from 'dotenv';
config({ path: '.env' });

import { and, eq, like, ne } from 'drizzle-orm';
import { db } from '@/lib/db';
import { documents, visaApplications } from '@/lib/db/schema';
import { travelerProfiles } from '@/lib/db/schema-traveler-profiles';
import { travelerProfileKey } from '@/lib/dashboard/travelerIdentity';
import {
  ensureTravelerProfile,
  IncompleteTravelerIdentityError,
} from '@/lib/dashboard/travelerProfileStore';
import { isApplicantVaultSlot } from '@/lib/dashboard/vaultDocumentTypes';

type StoredTraveller = {
  passengerId?: string;
  name?: string;
  passportData?: Record<string, unknown> | null;
  documents?: Array<{ key?: string; slotKey?: string }> | null;
};

async function main() {
  const apps = await db
    .select({
      id: visaApplications.id,
      userId: visaApplications.userId,
      travellers: visaApplications.travellers,
      status: visaApplications.status,
    })
    .from(visaApplications)
    .where(ne(visaApplications.status, 'draft'));

  let profilesCreated = 0;
  let docsLinked = 0;
  let skippedIdentity = 0;

  for (const app of apps) {
    const travellers = Array.isArray(app.travellers)
      ? (app.travellers as StoredTraveller[])
      : [];
    const passengerToProfile = new Map<string, string>();

    for (const traveller of travellers) {
      try {
        const before = await db
          .select({ id: travelerProfiles.id })
          .from(travelerProfiles)
          .where(
            and(
              eq(travelerProfiles.userId, app.userId),
              eq(
                travelerProfiles.identityKey,
                travelerProfileKey(traveller) || '__none__'
              )
            )
          )
          .limit(1);
        const profile = await ensureTravelerProfile(db, app.userId, traveller);
        if (before.length === 0) profilesCreated += 1;
        if (traveller.passengerId) {
          passengerToProfile.set(traveller.passengerId, profile.id);
        }
      } catch (error) {
        if (error instanceof IncompleteTravelerIdentityError) {
          skippedIdentity += 1;
          continue;
        }
        throw error;
      }
    }

    const pathDocs = await db
      .select()
      .from(documents)
      .where(like(documents.s3Key, `%/${app.id}/%`));

    for (const doc of pathDocs) {
      if (!isApplicantVaultSlot(doc.documentType)) continue;
      if (doc.profileId && doc.userId) continue;

      const passengerId =
        /\/passengers\/([^/]+)\//.exec(doc.s3Key)?.[1] || null;
      const profileId = passengerId
        ? passengerToProfile.get(passengerId)
        : undefined;
      if (!profileId) continue;

      await db
        .update(documents)
        .set({
          userId: app.userId,
          profileId,
          visibility: doc.visibility || 'active',
        })
        .where(eq(documents.id, doc.id));
      docsLinked += 1;
    }
  }

  // Soft-hide duplicate active slots per profile
  const profiles = await db
    .select({ id: travelerProfiles.id })
    .from(travelerProfiles);
  let hidden = 0;
  for (const profile of profiles) {
    const active = await db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.profileId, profile.id),
          eq(documents.visibility, 'active')
        )
      );
    const byType = new Map<string, typeof active>();
    for (const doc of active) {
      const list = byType.get(doc.documentType) ?? [];
      list.push(doc);
      byType.set(doc.documentType, list);
    }
    for (const rows of byType.values()) {
      if (rows.length < 2) continue;
      rows.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
      const keep = rows[0];
      for (const row of rows.slice(1)) {
        await db
          .update(documents)
          .set({
            visibility: 'hidden',
            supersededByDocumentId: keep.id,
          })
          .where(eq(documents.id, row.id));
        hidden += 1;
      }
    }
  }

  console.log(
    JSON.stringify(
      { profilesCreated, docsLinked, skippedIdentity, hidden },
      null,
      2
    )
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
