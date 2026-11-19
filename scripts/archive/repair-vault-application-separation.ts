/**
 * Repair: ensure applicant vault rows under users/ stay profile-owned
 * without application stamps (columns removed). Soft-hide superseded slots.
 *
 * Run: npx tsx --tsconfig tsconfig.json scripts/repair-vault-application-separation.ts
 */

import { and, eq, isNotNull, like, ne } from 'drizzle-orm';
import { db } from '@/lib/db';
import { documents } from '@/lib/db/schema';

async function main() {
  // Soft-hide non-active duplicates per profile+slot (keep newest active).
  const active = await db
    .select()
    .from(documents)
    .where(
      and(
        isNotNull(documents.profileId),
        eq(documents.visibility, 'active'),
        like(documents.s3Key, 'users/%')
      )
    );

  const bySlot = new Map<string, typeof active>();
  for (const row of active) {
    if (!row.profileId) continue;
    const key = `${row.profileId}::${row.documentType}`;
    const list = bySlot.get(key) ?? [];
    list.push(row);
    bySlot.set(key, list);
  }

  let hidden = 0;
  for (const rows of bySlot.values()) {
    if (rows.length < 2) continue;
    rows.sort(
      (a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime()
    );
    const keep = rows[0];
    for (const row of rows.slice(1)) {
      await db
        .update(documents)
        .set({
          visibility: 'hidden',
          supersededByDocumentId: keep.id,
        })
        .where(and(eq(documents.id, row.id), ne(documents.id, keep.id)));
      hidden += 1;
    }
  }

  console.log(`Hidden ${hidden} duplicate vault slot rows`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
