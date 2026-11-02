/**
 * Backfill visa_applications.reference_number for any rows still NULL.
 * Safe to re-run after `npm run db:migrate`.
 */
import 'dotenv/config';
import { eq, isNull } from 'drizzle-orm';
import { db } from '../lib/db';
import { visaApplications } from '../lib/db/schema';
import { ensureUniqueVisaReferenceNumber } from '../lib/visa/reference-number';

async function main() {
  const missing = await db
    .select({ id: visaApplications.id })
    .from(visaApplications)
    .where(isNull(visaApplications.referenceNumber));

  console.log(
    `Found ${missing.length} visa application(s) without reference_number`
  );

  let updated = 0;
  for (const row of missing) {
    const referenceNumber = await ensureUniqueVisaReferenceNumber(db);
    await db
      .update(visaApplications)
      .set({ referenceNumber })
      .where(eq(visaApplications.id, row.id));
    updated += 1;
    console.log(`  ${row.id} → ${referenceNumber}`);
  }

  console.log(`Backfill complete. Updated ${updated} row(s).`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
