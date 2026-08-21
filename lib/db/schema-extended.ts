/**
 * Extended Database Schema - Competitive Features
 *
 * Multi-country visa support, premium tier pricing, dynamic form fields,
 * and document validation settings.
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
  char,
  index
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================================================
// ENUMS
// ============================================================================

export const processTypeEnum = pgEnum('process_type', [
  'electronic_travel_authorisation', // eTA, TDAC (Thailand)
  'afc',                             // Application Facilitation Center (Japan physical)
  'visa',                            // Standard e-visa (Dubai)
  'appointment',                     // Visa appointment booking (USA)
  'visa_on_arrival',
  'sticker_visa',
  'visa_free'
]);

export const questionTypeEnum = pgEnum('question_type', [
  'text',
  'date',
  'select',
  'dropdown',
  'file',
  'flight',
  'boolean'
]);

export const purposeEnum = pgEnum('purpose', [
  'tourism',
  'business',
  'work',
  'study',
  'family',
  'medical',
  'transit'
]);

export const unitEnum = pgEnum('unit', [
  'minutes',
  'hours',
  'days',
  'months',
  'years'
]);

// ============================================================================
// COUNTRY & VISA CONFIGURATION TABLES
// ============================================================================

/**
 * Countries - Destination countries with metadata
 */
export const countries = pgTable('countries', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  iso2Code: char('iso2_code', { length: 2 }).notNull().unique(),
  supported: boolean('supported').default(true).notNull(),
  enabled: boolean('enabled').default(true).notNull(),

  // Images - All stored as JSON for better structure
  images: jsonb('images').$type<{
    banner?: {
      url: string;
      alt?: string;
      width?: number;
      height?: number;
    };
    hero?: {
      url: string;
      alt?: string;
      width?: number;
      height?: number;
    };
    flag?: {
      url: string;
    };
  }>(),

  // SEO - Stored as JSON for better organization
  seo: jsonb('seo').$type<{
    metaTitle?: string;
    metaDescription?: string;
    headline?: string;
  }>(),

  showAuthorizationTag: boolean('show_authorization_tag').default(false),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => ({
  iso2CodeIdx: index('countries_iso2_code_idx').on(table.iso2Code)
}));

/**
 * Visa Listings - Core visa/entry product definitions
 * Fees and validity/stay live on visa_listing_prices (multiple options per listing).
 */
export const visaListings = pgTable('visa_listings', {
  id: uuid('id').primaryKey().defaultRandom(),
  processName: varchar('process_name', { length: 100 }).notNull(), // "Thailand TDAC", "Dubai Tourist Visa"
  destinationCountry: char('destination_country', { length: 2 }).references(() => countries.iso2Code).notNull(),
  purpose: purposeEnum('purpose').default('tourism').notNull(),
  processType: processTypeEnum('process_type').notNull(),
  processTypeLabel: varchar('process_type_label', { length: 50 }), // "TDAC", "E-Visa", etc.
  processPhysical: boolean('process_physical').default(false).notNull(), // true for Japan sticker visa

  entryType: varchar('entry_type', { length: 50 }), // "Tourism", "B1/B2", etc.
  isMultipleEntry: boolean('is_multiple_entry').default(false),

  // Support flags
  familyEnabled: boolean('family_enabled').default(false).notNull(),
  unsupported: boolean('unsupported').default(false),
  visaOnArrival: boolean('visa_on_arrival').default(false),
  visaFree: boolean('visa_free').default(false),

  // Standard ETA (Estimated Time to Approval) — listing-level
  standardEtaDuration: integer('standard_eta_duration'), // 30, 48, etc.
  standardEtaUnit: unitEnum('standard_eta_unit'), // 'minutes', 'hours', 'days'

  // Feature flags & config
  devOptions: jsonb('dev_options').$type<{
    onlyB2b?: boolean;
    onlyB2c?: boolean;
    b2eEnabled?: boolean;
    iosMinVersion?: string;
    androidMinVersion?: number;
    daysOff?: string[]; // ["2026-12-25"]
    b2cEnableCheckoutPwon?: boolean; // Pay When Ready
    mainTravelerMinAge?: number;
  }>().default({}),

  lastEditedBy: varchar('last_edited_by', { length: 100 }),
  sourceUrl: text('source_url'), // Official government URL

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => ({
  destinationCountryIdx: index('visa_listings_destination_country_idx').on(table.destinationCountry)
}));

/**
 * Visa Listing Prices — multiple packages per listing
 * Each option: entry validity + stay duration + three INR fees
 */
export const visaListingPrices = pgTable('visa_listing_prices', {
  id: uuid('id').primaryKey().defaultRandom(),
  visaListingId: uuid('visa_listing_id').references(() => visaListings.id, { onDelete: 'cascade' }).notNull(),

  entryValidityAmount: integer('entry_validity_amount'),
  entryValidityUnit: unitEnum('entry_validity_unit'),
  entryLengthStayAmount: integer('entry_length_stay_amount'),
  entryLengthStayUnit: unitEnum('entry_length_stay_unit'),

  governmentFeeAmount: decimal('government_fee_amount', { precision: 10, scale: 2 }).default('0'),
  serviceFeeAmount: decimal('service_fee_amount', { precision: 10, scale: 2 }).default('0'),
  governmentGstFeeAmount: decimal('government_gst_fee_amount', { precision: 10, scale: 2 }).default('0'),

  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, (table) => ({
  visaListingIdIdx: index('visa_listing_prices_visa_listing_id_idx').on(table.visaListingId)
}));

/**
 * Multi-Trip Countries - Additional countries valid with single visa
 *
 * Example: Japan visa also valid for KR, VN, MY, SG, JO, MN
 */
export const multiTripCountries = pgTable('multi_trip_countries', {
  id: uuid('id').primaryKey().defaultRandom(),
  visaListingId: uuid('visa_listing_id').references(() => visaListings.id, { onDelete: 'cascade' }).notNull(),
  additionalCountryCode: char('additional_country_code', { length: 2 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, (table) => ({
  visaListingIdIdx: index('multi_trip_countries_visa_listing_id_idx').on(table.visaListingId)
}));

/**
 * Visa Risks - Pre-qualification risk factors
 */
export const visaRisks = pgTable('visa_risks', {
  id: uuid('id').primaryKey().defaultRandom(),
  countryId: uuid('country_id').references(() => countries.id).notNull(),
  expiredPassport: boolean('expired_passport').default(false),
  insufficientFunds: boolean('insufficient_funds').default(false),
  criminalRecord: boolean('criminal_record').default(false),
  previousVisaViolations: boolean('previous_visa_violations').default(false),
  invalidInsurance: boolean('invalid_insurance').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, (table) => ({
  countryIdIdx: index('visa_risks_country_id_idx').on(table.countryId)
}));

// ============================================================================
// DYNAMIC FORM CONFIGURATION
// ============================================================================

/**
 * Additional Questions - Country-specific dynamic form fields
 */
export const additionalQuestions = pgTable('additional_questions', {
  id: uuid('id').primaryKey().defaultRandom(),
  visaListingId: uuid('visa_listing_id').references(() => visaListings.id, { onDelete: 'cascade' }).notNull(),
  key: varchar('key', { length: 50 }).notNull(), // 'flight_number', 'hotel', 'occupation'
  label: text('label').notNull(),
  description: text('description'),
  questionType: questionTypeEnum('question_type').notNull(),
  required: boolean('required').default(false),
  familyEnabled: boolean('family_enabled').default(false),
  onlyB2b: boolean('only_b2b').default(false),
  extraInfo: text('extra_info'),
  requiredDoc: varchar('required_doc', { length: 100 }),
  sourceUrl: text('source_url'),

  // For dropdown/select types (e.g., 57 occupation options)
  options: jsonb('options').$type<Array<{ label: string; value: string }>>().default([]),

  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, (table) => ({
  visaListingIdIdx: index('additional_questions_visa_listing_id_idx').on(table.visaListingId)
}));

/**
 * Components Required - Document requirements (passport, photo, Aadhaar, etc.)
 * Chargeable amounts are INR only.
 */
export const componentsRequired = pgTable('components_required', {
  id: uuid('id').primaryKey().defaultRandom(),
  visaListingId: uuid('visa_listing_id').references(() => visaListings.id, { onDelete: 'cascade' }).notNull(),
  key: varchar('key', { length: 50 }).notNull(), // 'passport', 'photo', 'india_aadhaar', 'pan_card'
  amount: decimal('amount', { precision: 10, scale: 2 }).default('0'),
  chargeable: boolean('chargeable').default(false),
  familyEnabled: boolean('family_enabled').default(false),
  onlyB2b: boolean('only_b2b').default(false),
  toggle: boolean('toggle').default(false),

  // Validation attributes
  attributes: jsonb('attributes').$type<string[]>().default([]),
  // Examples: ['validity_required', 'image_required', 'fathers_name_required', 'mothers_name_required']

  sortOrder: integer('sort_order').default(0).notNull(),
  sourceUrl: text('source_url'),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, (table) => ({
  visaListingIdIdx: index('components_required_visa_listing_id_idx').on(table.visaListingId)
}));

/**
 * Occupation Types - Standard occupation list (57 types)
 */
export const occupationTypes = pgTable('occupation_types', {
  id: uuid('id').primaryKey().defaultRandom(),
  label: varchar('label', { length: 100 }).notNull().unique(),
  value: varchar('value', { length: 100 }).notNull(),
  sortOrder: integer('sort_order').default(0),
  active: boolean('active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

/**
 * FAQs - Country-specific help content
 */
export const faqs = pgTable('faqs', {
  id: uuid('id').primaryKey().defaultRandom(),
  visaListingId: uuid('visa_listing_id').references(() => visaListings.id, { onDelete: 'cascade' }).notNull(),
  question: text('question').notNull(),
  answer: text('answer').notNull(), // Markdown format
  category: varchar('category', { length: 100 }),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, (table) => ({
  visaListingIdIdx: index('faqs_visa_listing_id_idx').on(table.visaListingId)
}));

/**
 * Post-Checkout Steps - Process timeline
 */
export const postCheckoutSteps = pgTable('post_checkout_steps', {
  id: uuid('id').primaryKey().defaultRandom(),
  visaListingId: uuid('visa_listing_id').references(() => visaListings.id, { onDelete: 'cascade' }).notNull(),
  heading: text('heading').notNull(),
  subheading: text('subheading'),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, (table) => ({
  visaListingIdIdx: index('post_checkout_steps_visa_listing_id_idx').on(table.visaListingId)
}));

// ============================================================================
// VALIDATION SETTINGS
// ============================================================================

/**
 * Passport OCR Settings - Document validation rules
 */
export const passportOcrSettings = pgTable('passport_ocr_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  visaListingId: uuid('visa_listing_id').references(() => visaListings.id, { onDelete: 'cascade' }).notNull(),
  skipBlurDetection: boolean('skip_blur_detection').default(false),
  skipGlareDetection: boolean('skip_glare_detection').default(false),
  skipFingersDetection: boolean('skip_fingers_detection').default(false),
  useStrictFingersDetectionModel: boolean('use_strict_fingers_detection_model').default(true),
  enableTravelDocCheck: boolean('enable_travel_doc_check').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, (table) => ({
  visaListingIdIdx: index('passport_ocr_settings_visa_listing_id_idx').on(table.visaListingId)
}));

/**
 * Photo Validation Settings - Biometric photo compliance (ICAO standards)
 */
export const photoValidationSettings = pgTable('photo_validation_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  visaListingId: uuid('visa_listing_id').references(() => visaListings.id, { onDelete: 'cascade' }).notNull(),
  settingType: varchar('setting_type', { length: 50 }).notNull(), // 'live_capture' or 'upload'

  // 16 validation checks
  restrictInvalidPhoto: boolean('restrict_invalid_photo').default(true),
  restrictMultipleFaces: boolean('restrict_multiple_faces').default(true),
  restrictFaceOutsideFrame: boolean('restrict_face_outside_frame').default(true),
  restrictCoveredFace: boolean('restrict_covered_face').default(true),
  restrictClosedEyes: boolean('restrict_closed_eyes').default(true),
  restrictGlasses: boolean('restrict_glasses').default(true),
  restrictHeadcover: boolean('restrict_headcover').default(false),
  restrictNotCenteredFace: boolean('restrict_not_centered_face').default(false),
  restrictNotStraightFace: boolean('restrict_not_straight_face').default(false),
  restrictImproperLightConditions: boolean('restrict_improper_light_conditions').default(false),
  restrictTooCloseFace: boolean('restrict_too_close_face').default(false),
  restrictTooFarFace: boolean('restrict_too_far_face').default(false),
  restrictTeethVisibility: boolean('restrict_teeth_visibility').default(true),
  restrictHairInFront: boolean('restrict_hair_in_front').default(true),
  restrictEarsNotVisible: boolean('restrict_ears_not_visible').default(false),
  restrictShouldersVisible: boolean('restrict_shoulders_visible').default(false),

  createdAt: timestamp('created_at').defaultNow().notNull()
}, (table) => ({
  visaListingIdIdx: index('photo_validation_settings_visa_listing_id_idx').on(table.visaListingId)
}));

// ============================================================================
// RELATIONS
// ============================================================================

export const countriesRelations = relations(countries, ({ many }) => ({
  visaListings: many(visaListings),
  visaRisks: many(visaRisks)
}));

export const visaListingsRelations = relations(visaListings, ({ one, many }) => ({
  country: one(countries, {
    fields: [visaListings.destinationCountry],
    references: [countries.iso2Code]
  }),
  prices: many(visaListingPrices),
  multiTripCountries: many(multiTripCountries),
  additionalQuestions: many(additionalQuestions),
  componentsRequired: many(componentsRequired),
  passportOcrSettings: one(passportOcrSettings),
  photoValidationSettings: many(photoValidationSettings),
  faqs: many(faqs),
  postCheckoutSteps: many(postCheckoutSteps)
}));

export const visaListingPricesRelations = relations(visaListingPrices, ({ one }) => ({
  visaListing: one(visaListings, {
    fields: [visaListingPrices.visaListingId],
    references: [visaListings.id]
  })
}));

export const multiTripCountriesRelations = relations(multiTripCountries, ({ one }) => ({
  visaListing: one(visaListings, {
    fields: [multiTripCountries.visaListingId],
    references: [visaListings.id]
  })
}));

export const additionalQuestionsRelations = relations(additionalQuestions, ({ one }) => ({
  visaListing: one(visaListings, {
    fields: [additionalQuestions.visaListingId],
    references: [visaListings.id]
  })
}));

export const componentsRequiredRelations = relations(componentsRequired, ({ one }) => ({
  visaListing: one(visaListings, {
    fields: [componentsRequired.visaListingId],
    references: [visaListings.id]
  })
}));

export const visaRisksRelations = relations(visaRisks, ({ one }) => ({
  country: one(countries, {
    fields: [visaRisks.countryId],
    references: [countries.id]
  })
}));

export const passportOcrSettingsRelations = relations(passportOcrSettings, ({ one }) => ({
  visaListing: one(visaListings, {
    fields: [passportOcrSettings.visaListingId],
    references: [visaListings.id]
  })
}));

export const photoValidationSettingsRelations = relations(photoValidationSettings, ({ one }) => ({
  visaListing: one(visaListings, {
    fields: [photoValidationSettings.visaListingId],
    references: [visaListings.id]
  })
}));

export const faqsRelations = relations(faqs, ({ one }) => ({
  visaListing: one(visaListings, {
    fields: [faqs.visaListingId],
    references: [visaListings.id]
  })
}));

export const postCheckoutStepsRelations = relations(postCheckoutSteps, ({ one }) => ({
  visaListing: one(visaListings, {
    fields: [postCheckoutSteps.visaListingId],
    references: [visaListings.id]
  })
}));

// ============================================================================
// TYPES
// ============================================================================

export type Country = typeof countries.$inferSelect;
export type NewCountry = typeof countries.$inferInsert;

export type VisaListing = typeof visaListings.$inferSelect;
export type NewVisaListing = typeof visaListings.$inferInsert;

/** @deprecated Use VisaListing */
export type EntryProcess = VisaListing;
/** @deprecated Use NewVisaListing */
export type NewEntryProcess = NewVisaListing;

export type VisaListingPrice = typeof visaListingPrices.$inferSelect;
export type NewVisaListingPrice = typeof visaListingPrices.$inferInsert;

export type MultiTripCountry = typeof multiTripCountries.$inferSelect;
export type NewMultiTripCountry = typeof multiTripCountries.$inferInsert;

export type VisaRisk = typeof visaRisks.$inferSelect;
export type NewVisaRisk = typeof visaRisks.$inferInsert;

export type AdditionalQuestion = typeof additionalQuestions.$inferSelect;
export type NewAdditionalQuestion = typeof additionalQuestions.$inferInsert;

export type ComponentRequired = typeof componentsRequired.$inferSelect;
export type NewComponentRequired = typeof componentsRequired.$inferInsert;

export type OccupationType = typeof occupationTypes.$inferSelect;
export type NewOccupationType = typeof occupationTypes.$inferInsert;

export type Faq = typeof faqs.$inferSelect;
export type NewFaq = typeof faqs.$inferInsert;

export type PostCheckoutStep = typeof postCheckoutSteps.$inferSelect;
export type NewPostCheckoutStep = typeof postCheckoutSteps.$inferInsert;

export type PassportOcrSetting = typeof passportOcrSettings.$inferSelect;
export type NewPassportOcrSetting = typeof passportOcrSettings.$inferInsert;

export type PhotoValidationSetting = typeof photoValidationSettings.$inferSelect;
export type NewPhotoValidationSetting = typeof photoValidationSettings.$inferInsert;
