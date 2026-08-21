/**
 * Seed script for occupation types
 *
 * Imports 57 occupation types from Dubai visa requirements
 *
 * Usage:
 * ```bash
 * npm run db:seed:occupations
 * ```
 */

import 'dotenv/config';
import { db } from '../index';
import { occupationTypes } from '../schema-extended';
import { occupations } from './occupations';

async function seedOccupations() {
  console.log('🌱 Seeding occupation types...\n');

  try {
    const inserted = await db.insert(occupationTypes).values(occupations).returning();
    console.log(`✅ Inserted ${inserted.length} occupation types`);
    console.log('\nSample occupations:');
    inserted.slice(0, 5).forEach(occ => {
      console.log(`  - ${occ.label}`);
    });
    console.log(`  ... and ${inserted.length - 5} more\n`);

  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
}

// Run seed
seedOccupations()
  .then(() => {
    console.log('✅ Occupation types seed complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  });
