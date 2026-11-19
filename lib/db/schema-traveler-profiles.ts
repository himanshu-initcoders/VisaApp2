/**
 * Traveler profile vault table — kept outside schema.ts so vault writers
 * can import it without joining the main schema circular graph.
 *
 * user_id FK is enforced in SQL (migration 0040); no Drizzle .references()
 * to users here, matching schema-extended's pattern for users FKs.
 */

import {
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const travelerProfiles = pgTable(
  'traveler_profiles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull(),
    identityKey: varchar('identity_key', { length: 255 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    passportNumber: varchar('passport_number', { length: 50 }),
    dateOfBirth: varchar('date_of_birth', { length: 32 }),
    nationality: varchar('nationality', { length: 100 }),
    sex: varchar('sex', { length: 20 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('traveler_profiles_user_identity_unique').on(
      table.userId,
      table.identityKey
    ),
    index('traveler_profiles_user_id_idx').on(table.userId),
  ]
);

export type TravelerProfileRow = typeof travelerProfiles.$inferSelect;
export type NewTravelerProfileRow = typeof travelerProfiles.$inferInsert;

