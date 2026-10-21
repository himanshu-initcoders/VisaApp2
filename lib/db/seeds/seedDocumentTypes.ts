/**
 * Seed script for document types catalog.
 *
 * Upserts the hardcoded DOCUMENT_TYPES list into document_types.
 * Does not overwrite existing labels or sample-document fields.
 *
 * Usage:
 * ```bash
 * npm run db:seed:document-types
 * ```
 */

import 'dotenv/config';
import { db } from '../index';
import { documentTypes } from '../schema-extended';
import { DOCUMENT_TYPES } from '@/lib/document-types';
import { sql } from 'drizzle-orm';

async function seedDocumentTypes() {
  console.log('🌱 Seeding document types...\n');

  try {
    const values = DOCUMENT_TYPES.map((type, index) => ({
      value: type.value,
      label: type.label,
      sortOrder: index,
    }));

    const inserted = await db
      .insert(documentTypes)
      .values(values)
      .onConflictDoUpdate({
        target: documentTypes.value,
        set: {
          // Keep admin-edited labels; only backfill sort_order for ordering stability
          sortOrder: sql`excluded.sort_order`,
          updatedAt: sql`now()`,
        },
      })
      .returning();

    console.log(`✅ Upserted ${inserted.length} document types`);
    console.log('\nSample types:');
    inserted.slice(0, 5).forEach((row) => {
      console.log(`  - ${row.value}: ${row.label}`);
    });
    if (inserted.length > 5) {
      console.log(`  ... and ${inserted.length - 5} more\n`);
    }
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
}

seedDocumentTypes()
  .then(() => {
    console.log('✅ Document types seed complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  });
