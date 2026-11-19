/**
 * Delete provisional / blank traveler profiles (id: keys, Traveller shells).
 *
 * Run: npx tsx --tsconfig tsconfig.json scripts/cleanup-blank-traveler-profiles.ts
 */

import { config } from 'dotenv';
config({ path: '.env' });

import { deleteBlankTravelerProfiles } from '@/lib/dashboard/travelerProfileStore';
import { db } from '@/lib/db';

async function main() {
  const result = await deleteBlankTravelerProfiles(db);
  console.log(
    `Deleted ${result.deleted} blank profiles; migrated ${result.migrated} to npd: keys`
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
