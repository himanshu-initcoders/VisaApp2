/**
 * Passport service catalog — India-only Fresh / Re-issue products.
 * Separate from visa_listings; applications live in passport_services (schema.ts).
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  decimal,
  timestamp,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { questionTypeEnum, unitEnum } from './schema-extended';

export const passportServiceTypeEnum = pgEnum('passport_service_type', [
  'fresh',
  'reissue',
]);

export const passportSchemeEnum = pgEnum('passport_scheme', [
  'normal',
  'tatkaal',
]);

export const passportBookletPagesEnum = pgEnum('passport_booklet_pages', [
  '36',
  '60',
]);

/**
 * Passport Listings — Fresh and Re-issue product roots (India only).
 */
export const passportListings = pgTable(
  'passport_listings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    serviceType: passportServiceTypeEnum('service_type').notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    slug: varchar('slug', { length: 120 }).notNull(),
    description: text('description'),
    standardEtaDuration: integer('standard_eta_duration'),
    standardEtaUnit: unitEnum('standard_eta_unit'),
    isActive: boolean('is_active').default(true).notNull(),
    seo: jsonb('seo').$type<{
      metaTitle?: string;
      metaDescription?: string;
      headline?: string;
    }>(),
    lastEditedBy: varchar('last_edited_by', { length: 100 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    serviceTypeUnique: uniqueIndex('passport_listings_service_type_unique').on(
      table.serviceType
    ),
    slugUnique: uniqueIndex('passport_listings_slug_unique').on(table.slug),
  })
);

/**
 * Passport Listing Prices — Normal/Tatkaal × 36/60 pages + fees.
 */
export const passportListingPrices = pgTable(
  'passport_listing_prices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    passportListingId: uuid('passport_listing_id')
      .references(() => passportListings.id, { onDelete: 'cascade' })
      .notNull(),
    scheme: passportSchemeEnum('scheme').notNull(),
    bookletPages: passportBookletPagesEnum('booklet_pages').notNull(),
    governmentFeeAmount: decimal('government_fee_amount', {
      precision: 10,
      scale: 2,
    })
      .default('0')
      .notNull(),
    serviceFeeAmount: decimal('service_fee_amount', {
      precision: 10,
      scale: 2,
    })
      .default('0')
      .notNull(),
    governmentGstFeeAmount: decimal('government_gst_fee_amount', {
      precision: 10,
      scale: 2,
    })
      .default('0')
      .notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    listingIdx: index('passport_listing_prices_listing_id_idx').on(
      table.passportListingId
    ),
    matrixUnique: uniqueIndex('passport_listing_prices_matrix_unique').on(
      table.passportListingId,
      table.scheme,
      table.bookletPages
    ),
  })
);

/**
 * Admin-defined form steps (tabs) for the passport apply wizard.
 */
export const passportFormSteps = pgTable(
  'passport_form_steps',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    passportListingId: uuid('passport_listing_id')
      .references(() => passportListings.id, { onDelete: 'cascade' })
      .notNull(),
    title: varchar('title', { length: 120 }).notNull(),
    description: text('description'),
    sortOrder: integer('sort_order').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    listingIdx: index('passport_form_steps_listing_id_idx').on(
      table.passportListingId
    ),
  })
);

/**
 * Dynamic questions scoped to a form step.
 */
export const passportAdditionalQuestions = pgTable(
  'passport_additional_questions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    passportListingId: uuid('passport_listing_id')
      .references(() => passportListings.id, { onDelete: 'cascade' })
      .notNull(),
    stepId: uuid('step_id')
      .references(() => passportFormSteps.id, { onDelete: 'cascade' })
      .notNull(),
    key: varchar('key', { length: 50 }).notNull(),
    label: text('label').notNull(),
    description: text('description'),
    questionType: questionTypeEnum('question_type').notNull(),
    required: boolean('required').default(false),
    extraInfo: text('extra_info'),
    requiredDoc: varchar('required_doc', { length: 100 }),
    sourceUrl: text('source_url'),
    options: jsonb('options')
      .$type<Array<{ label: string; value: string }>>()
      .default([]),
    visibility: jsonb('visibility')
      .$type<{
        enabled: true;
        sourceQuestionKey: string;
        operator: 'equals' | 'is_empty' | 'is_filled';
        value: string;
      } | null>()
      .default(null),
    documentConditions: jsonb('document_conditions')
      .$type<{
        enabled: true;
        operator: 'equals' | 'is_empty' | 'is_filled';
        value: string;
        documents: Array<{ documentType: string; required: boolean }>;
      } | null>()
      .default(null),
    sortOrder: integer('sort_order').default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    listingIdx: index('passport_additional_questions_listing_id_idx').on(
      table.passportListingId
    ),
    stepIdx: index('passport_additional_questions_step_id_idx').on(table.stepId),
  })
);

/**
 * Document requirements — picks from global document_types catalog.
 */
export const passportComponentsRequired = pgTable(
  'passport_components_required',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    passportListingId: uuid('passport_listing_id')
      .references(() => passportListings.id, { onDelete: 'cascade' })
      .notNull(),
    key: varchar('key', { length: 50 }).notNull(),
    documentType: varchar('document_type', { length: 80 }),
    label: text('label'),
    amount: decimal('amount', { precision: 10, scale: 2 }).default('0'),
    chargeable: boolean('chargeable').default(false),
    toggle: boolean('toggle').default(false),
    attributes: jsonb('attributes').$type<string[]>().default([]),
    sortOrder: integer('sort_order').default(0).notNull(),
    sourceUrl: text('source_url'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    listingIdx: index('passport_components_required_listing_id_idx').on(
      table.passportListingId
    ),
  })
);

export const passportFaqs = pgTable(
  'passport_faqs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    passportListingId: uuid('passport_listing_id')
      .references(() => passportListings.id, { onDelete: 'cascade' })
      .notNull(),
    question: text('question').notNull(),
    answer: text('answer').notNull(),
    category: varchar('category', { length: 100 }),
    sortOrder: integer('sort_order').default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    listingIdx: index('passport_faqs_listing_id_idx').on(table.passportListingId),
  })
);

// ============================================================================
// RELATIONS
// ============================================================================

export const passportListingsRelations = relations(
  passportListings,
  ({ many }) => ({
    prices: many(passportListingPrices),
    formSteps: many(passportFormSteps),
    additionalQuestions: many(passportAdditionalQuestions),
    componentsRequired: many(passportComponentsRequired),
    faqs: many(passportFaqs),
  })
);

export const passportListingPricesRelations = relations(
  passportListingPrices,
  ({ one }) => ({
    listing: one(passportListings, {
      fields: [passportListingPrices.passportListingId],
      references: [passportListings.id],
    }),
  })
);

export const passportFormStepsRelations = relations(
  passportFormSteps,
  ({ one, many }) => ({
    listing: one(passportListings, {
      fields: [passportFormSteps.passportListingId],
      references: [passportListings.id],
    }),
    questions: many(passportAdditionalQuestions),
  })
);

export const passportAdditionalQuestionsRelations = relations(
  passportAdditionalQuestions,
  ({ one }) => ({
    listing: one(passportListings, {
      fields: [passportAdditionalQuestions.passportListingId],
      references: [passportListings.id],
    }),
    step: one(passportFormSteps, {
      fields: [passportAdditionalQuestions.stepId],
      references: [passportFormSteps.id],
    }),
  })
);

export const passportComponentsRequiredRelations = relations(
  passportComponentsRequired,
  ({ one }) => ({
    listing: one(passportListings, {
      fields: [passportComponentsRequired.passportListingId],
      references: [passportListings.id],
    }),
  })
);

export const passportFaqsRelations = relations(passportFaqs, ({ one }) => ({
  listing: one(passportListings, {
    fields: [passportFaqs.passportListingId],
    references: [passportListings.id],
  }),
}));

// ============================================================================
// TYPES
// ============================================================================

export type PassportListing = typeof passportListings.$inferSelect;
export type NewPassportListing = typeof passportListings.$inferInsert;

export type PassportListingPrice = typeof passportListingPrices.$inferSelect;
export type NewPassportListingPrice = typeof passportListingPrices.$inferInsert;

export type PassportFormStep = typeof passportFormSteps.$inferSelect;
export type NewPassportFormStep = typeof passportFormSteps.$inferInsert;

export type PassportAdditionalQuestion =
  typeof passportAdditionalQuestions.$inferSelect;
export type NewPassportAdditionalQuestion =
  typeof passportAdditionalQuestions.$inferInsert;

export type PassportComponentRequired =
  typeof passportComponentsRequired.$inferSelect;
export type NewPassportComponentRequired =
  typeof passportComponentsRequired.$inferInsert;

export type PassportFaq = typeof passportFaqs.$inferSelect;
export type NewPassportFaq = typeof passportFaqs.$inferInsert;
