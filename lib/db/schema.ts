import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  boolean,
  integer,
  char,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { countries, visaListings } from './schema-extended';

/**
 * Users table - stores user account information
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    /** Nullable for phone-OTP applicants (no password). */
    passwordHash: varchar('password_hash', { length: 255 }),
    name: varchar('name', { length: 255 }).notNull(),
    /** 10-digit Indian mobile; unique when present. */
    phone: varchar('phone', { length: 20 }),
    emailVerified: timestamp('email_verified'),
    phoneVerified: timestamp('phone_verified'),
    role: varchar('role', { length: 50 }).notNull().default('user'), // user, admin, reviewer
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('users_phone_unique').on(table.phone)]
);

/**
 * Client apply drafts synced after applicant OTP login (JSON only; files stay in IndexedDB).
 */
export const applicationDrafts = pgTable(
  'application_drafts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    listingId: uuid('listing_id').notNull(),
    countryCode: char('country_code', { length: 2 }),
    payload: jsonb('payload').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('application_drafts_user_listing_unique').on(
      table.userId,
      table.listingId
    ),
  ]
);

/**
 * Immutable published form config snapshots per listing (Phase 3).
 */
export const formVersions = pgTable(
  'form_versions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    listingId: uuid('listing_id')
      .references(() => visaListings.id, { onDelete: 'cascade' })
      .notNull(),
    version: integer('version').notNull(),
    config: jsonb('config').notNull(),
    publishedAt: timestamp('published_at').defaultNow().notNull(),
    publishedBy: uuid('published_by').references(() => users.id),
  },
  (table) => [
    uniqueIndex('form_versions_listing_version_unique').on(
      table.listingId,
      table.version
    ),
    index('form_versions_listing_id_idx').on(table.listingId),
  ]
);

/**
 * Visa Applications table
 */
export const visaApplications = pgTable(
  'visa_applications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id)
      .notNull(),

    countryCode: char('country_code', { length: 2 }).references(
      () => countries.iso2Code
    ),
    visaListingId: uuid('visa_listing_id').references(() => visaListings.id),

    // Legacy free-text country (kept for older rows)
    country: varchar('country', { length: 100 }),

    visaType: varchar('visa_type', { length: 100 }).notNull(), // tourist, business, student, etc.
    status: varchar('status', { length: 50 }).notNull().default('draft'), // draft, submitted, under_review, approved, rejected
    personalInfo: jsonb('personal_info'), // stores form data
    travelInfo: jsonb('travel_info'), // travel dates, purpose, etc.
    employmentInfo: jsonb('employment_info'), // work details if needed
    documents: jsonb('documents'), // array of document references

    /** Phase 3: published form version pointer + frozen config */
    formVersionId: uuid('form_version_id').references(() => formVersions.id),
    formSnapshot: jsonb('form_snapshot'),
    /** Multi-passenger payload (one row per submission) */
    travellers: jsonb('travellers'),
    /** Denormalized filter columns */
    applicantName: varchar('applicant_name', { length: 255 }),
    applicantPhone: varchar('applicant_phone', { length: 20 }),
    passengerNames: text('passenger_names'),
    /** Client idempotency key for mock-pay submit */
    submitId: uuid('submit_id'),

    paymentId: uuid('payment_id'),
    submittedAt: timestamp('submitted_at'),
    reviewedAt: timestamp('reviewed_at'),
    completedAt: timestamp('completed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('visa_applications_submit_id_unique').on(table.submitId),
    index('visa_applications_status_submitted_at_idx').on(
      table.status,
      table.submittedAt
    ),
    index('visa_applications_country_code_idx').on(table.countryCode),
    index('visa_applications_applicant_phone_idx').on(table.applicantPhone),
  ]
);

/**
 * Passport Services table
 */
export const passportServices = pgTable('passport_services', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id)
    .notNull(),
  serviceType: varchar('service_type', { length: 50 }).notNull(), // NEW, RENEWAL, UPDATE
  status: varchar('status', { length: 50 }).notNull().default('draft'),
  personalInfo: jsonb('personal_info'),
  addressInfo: jsonb('address_info'),
  documents: jsonb('documents'),
  appointmentDate: timestamp('appointment_date'),
  appointmentLocation: varchar('appointment_location', { length: 255 }),
  paymentId: uuid('payment_id'),
  submittedAt: timestamp('submitted_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Documents table - stores references to uploaded documents
 */
export const documents = pgTable('documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  applicationId: uuid('application_id').notNull(), // references visa or passport application
  applicationType: varchar('application_type', { length: 50 }).notNull(), // 'visa' or 'passport'
  documentType: varchar('document_type', { length: 100 }).notNull(), // passport_copy, photo, etc.
  s3Key: varchar('s3_key', { length: 500 }).notNull(),
  filename: varchar('filename', { length: 255 }).notNull(),
  fileSize: integer('file_size'),
  mimeType: varchar('mime_type', { length: 100 }),
  verified: boolean('verified'), // null = unverified, true = verified, false = rejected
  verificationNotes: text('verification_notes'),
  uploadedAt: timestamp('uploaded_at').defaultNow().notNull(),
});

/**
 * Payments table
 */
export const payments = pgTable('payments', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id)
    .notNull(),
  applicationId: uuid('application_id').notNull(),
  applicationType: varchar('application_type', { length: 50 }).notNull(), // 'visa' or 'passport'
  amount: integer('amount').notNull(), // in paise (smallest currency unit)
  currency: varchar('currency', { length: 10 }).notNull().default('INR'),
  status: varchar('status', { length: 50 }).notNull().default('pending'), // pending, completed, failed, refunded
  paymentMethod: varchar('payment_method', { length: 50 }), // upi, card, netbanking
  transactionId: varchar('transaction_id', { length: 255 }),
  metadata: jsonb('metadata'), // payment gateway response
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});

/**
 * Application Status History - tracks status changes
 */
export const statusHistory = pgTable('status_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  applicationId: uuid('application_id').notNull(),
  applicationType: varchar('application_type', { length: 50 }).notNull(),
  oldStatus: varchar('old_status', { length: 50 }),
  newStatus: varchar('new_status', { length: 50 }).notNull(),
  changedBy: uuid('changed_by').references(() => users.id),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/**
 * Append-only admin call logs (Phase 3).
 */
export const applicationCallLogs = pgTable(
  'application_call_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    applicationId: uuid('application_id').notNull(),
    phone: varchar('phone', { length: 30 }).notNull(),
    note: text('note').notNull(),
    adminUserId: uuid('admin_user_id').references(() => users.id),
    adminName: varchar('admin_name', { length: 255 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('application_call_logs_application_id_idx').on(table.applicationId),
  ]
);

/**
 * Append-only admin notes (Phase 3).
 */
export const applicationNotes = pgTable(
  'application_notes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    applicationId: uuid('application_id').notNull(),
    body: text('body').notNull(),
    adminUserId: uuid('admin_user_id').references(() => users.id),
    adminName: varchar('admin_name', { length: 255 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('application_notes_application_id_idx').on(table.applicationId),
  ]
);

// Export types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type VisaApplication = typeof visaApplications.$inferSelect;
export type NewVisaApplication = typeof visaApplications.$inferInsert;

export type PassportService = typeof passportServices.$inferSelect;
export type NewPassportService = typeof passportServices.$inferInsert;

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;

export type StatusHistory = typeof statusHistory.$inferSelect;
export type NewStatusHistory = typeof statusHistory.$inferInsert;

export type ApplicationDraft = typeof applicationDrafts.$inferSelect;
export type NewApplicationDraft = typeof applicationDrafts.$inferInsert;

export type FormVersion = typeof formVersions.$inferSelect;
export type NewFormVersion = typeof formVersions.$inferInsert;

export type ApplicationCallLog = typeof applicationCallLogs.$inferSelect;
export type NewApplicationCallLog = typeof applicationCallLogs.$inferInsert;

export type ApplicationNote = typeof applicationNotes.$inferSelect;
export type NewApplicationNote = typeof applicationNotes.$inferInsert;

export type { VisaListing, NewVisaListing } from './schema-extended';
