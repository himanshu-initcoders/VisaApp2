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
} from 'drizzle-orm/pg-core';
import { countries, visaListings } from './schema-extended';

/**
 * Users table - stores user account information
 */
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 20 }),
  emailVerified: timestamp('email_verified'),
  phoneVerified: timestamp('phone_verified'),
  role: varchar('role', { length: 50 }).notNull().default('user'), // user, admin, reviewer
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Visa Applications table
 */
export const visaApplications = pgTable('visa_applications', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id)
    .notNull(),

  countryCode: char('country_code', { length: 2 })
    .references(() => countries.iso2Code),
  visaListingId: uuid('visa_listing_id')
    .references(() => visaListings.id),

  // Legacy free-text country (kept for older rows)
  country: varchar('country', { length: 100 }),

  visaType: varchar('visa_type', { length: 100 }).notNull(), // tourist, business, student, etc.
  status: varchar('status', { length: 50 }).notNull().default('draft'), // draft, submitted, under_review, approved, rejected
  personalInfo: jsonb('personal_info'), // stores form data
  travelInfo: jsonb('travel_info'), // travel dates, purpose, etc.
  employmentInfo: jsonb('employment_info'), // work details if needed
  documents: jsonb('documents'), // array of document references
  paymentId: uuid('payment_id'),
  submittedAt: timestamp('submitted_at'),
  reviewedAt: timestamp('reviewed_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

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
  verified: boolean('verified').default(false),
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

export type { VisaListing, NewVisaListing } from './schema-extended';
