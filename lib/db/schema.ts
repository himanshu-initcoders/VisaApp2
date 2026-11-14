import { sql } from 'drizzle-orm';
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
  foreignKey,
} from 'drizzle-orm/pg-core';
import { countries, visaListings } from './schema-extended';
import {
  passportListings,
  passportListingPrices,
} from './schema-passport';

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
    /** Set when an admin deactivates the account. Null means the account can sign in. */
    deactivatedAt: timestamp('deactivated_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('users_phone_unique').on(table.phone)]
);

/**
 * Active WhatsApp/login OTP challenges (one row per phone).
 * Code is stored hashed; expires after 10 minutes.
 */
export const phoneOtpChallenges = pgTable('phone_otp_challenges', {
  phone: varchar('phone', { length: 20 }).primaryKey(),
  codeHash: varchar('code_hash', { length: 128 }).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  attempts: integer('attempts').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/**
 * Active email OTP challenges (one row per normalized email).
 * Code is stored hashed; expires after 10 minutes.
 * Register challenges also store pending name + phone until verified.
 */
export const emailOtpChallenges = pgTable('email_otp_challenges', {
  email: varchar('email', { length: 255 }).primaryKey(),
  codeHash: varchar('code_hash', { length: 128 }).notNull(),
  purpose: varchar('purpose', { length: 20 }).notNull(), // login | register
  pendingName: varchar('pending_name', { length: 255 }),
  pendingPhone: varchar('pending_phone', { length: 20 }),
  expiresAt: timestamp('expires_at').notNull(),
  attempts: integer('attempts').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

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

    /**
     * Public application reference shown to users/admins (e.g. VI234567898765).
     * Internal FKs and actions still use `id` (UUID).
     */
    referenceNumber: varchar('reference_number', { length: 14 }).notNull(),

    countryCode: char('country_code', { length: 2 }).references(
      () => countries.iso2Code
    ),
    visaListingId: uuid('visa_listing_id').references(() => visaListings.id),

    // Legacy free-text country (kept for older rows)
    country: varchar('country', { length: 100 }),

    visaType: varchar('visa_type', { length: 100 }).notNull(), // tourist, business, student, etc.
    /** Case rollup of traveller visa statuses. */
    status: varchar('status', { length: 50 }).notNull().default('draft'), // draft, submitted, under_review, action_required, approved, rejected, partially_approved
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
    /** Client idempotency key for checkout / submit */
    submitId: uuid('submit_id'),
    /** Applicant opted in to visa insurance interest at checkout (optional). */
    interestedInInsurance: boolean('interested_in_insurance')
      .default(false)
      .notNull(),

    paymentId: uuid('payment_id'),
    /** Applicant or staff who last saved while status=draft. */
    savedByUserId: uuid('saved_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    /** Staff reviewer assigned to this visa application. */
    assignedReviewerId: uuid('assigned_reviewer_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    submittedAt: timestamp('submitted_at'),
    reviewedAt: timestamp('reviewed_at'),
    completedAt: timestamp('completed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('visa_applications_submit_id_unique').on(table.submitId),
    uniqueIndex('visa_applications_reference_number_unique').on(
      table.referenceNumber
    ),
    uniqueIndex('visa_applications_one_draft_per_user_listing')
      .on(table.userId, table.visaListingId)
      .where(sql`${table.status} = 'draft'`),
    index('visa_applications_status_submitted_at_idx').on(
      table.status,
      table.submittedAt
    ),
    index('visa_applications_country_code_idx').on(table.countryCode),
    index('visa_applications_applicant_phone_idx').on(table.applicantPhone),
    index('visa_applications_assigned_reviewer_id_idx').on(
      table.assignedReviewerId
    ),
  ]
);

/**
 * One visa outcome per traveller on a shared application.
 * The JSON `travellers` blob stays the form payload; this table is the status source.
 */
export const visaApplicationTravellers = pgTable(
  'visa_application_travellers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    applicationId: uuid('application_id')
      .references(() => visaApplications.id, { onDelete: 'cascade' })
      .notNull(),
    /** Matches the JSON passengerId (or `legacy-{applicationId}` / `traveller-{index}`). */
    passengerId: varchar('passenger_id', { length: 100 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    status: varchar('status', { length: 50 }).notNull().default('submitted'),
    reviewedAt: timestamp('reviewed_at'),
    completedAt: timestamp('completed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('visa_application_travellers_app_passenger_unique').on(
      table.applicationId,
      table.passengerId
    ),
    index('visa_application_travellers_application_id_idx').on(
      table.applicationId
    ),
    index('visa_application_travellers_status_idx').on(table.status),
  ]
);

/**
 * Immutable published form config snapshots per passport listing.
 */
export const passportFormVersions = pgTable(
  'passport_form_versions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    passportListingId: uuid('passport_listing_id')
      .references(() => passportListings.id, { onDelete: 'cascade' })
      .notNull(),
    version: integer('version').notNull(),
    config: jsonb('config').notNull(),
    publishedAt: timestamp('published_at').defaultNow().notNull(),
    publishedBy: uuid('published_by').references(() => users.id),
  },
  (table) => [
    uniqueIndex('passport_form_versions_listing_version_unique').on(
      table.passportListingId,
      table.version
    ),
    index('passport_form_versions_listing_id_idx').on(table.passportListingId),
  ]
);

/**
 * Passport Services — draft / submitted Indian passport applications.
 * serviceType: fresh | reissue
 * In-progress apply rows use status=draft (same table + storage path as submitted).
 */
export const passportServices = pgTable(
  'passport_services',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id)
      .notNull(),
    /** fresh | reissue */
    serviceType: varchar('service_type', { length: 50 }).notNull(),
    passportListingId: uuid('passport_listing_id').references(
      () => passportListings.id,
      { onDelete: 'set null' }
    ),
    priceOptionId: uuid('price_option_id').references(
      () => passportListingPrices.id,
      { onDelete: 'set null' }
    ),
    formVersionId: uuid('form_version_id').references(
      () => passportFormVersions.id
    ),
    formSnapshot: jsonb('form_snapshot'),
    answers: jsonb('answers'),
    referenceNumber: varchar('reference_number', { length: 32 }),
    status: varchar('status', { length: 50 }).notNull().default('draft'),
    personalInfo: jsonb('personal_info'),
    addressInfo: jsonb('address_info'),
    documents: jsonb('documents'),
    appointmentDate: timestamp('appointment_date'),
    appointmentLocation: varchar('appointment_location', { length: 255 }),
    /** Client idempotency key for checkout / submit */
    submitId: uuid('submit_id'),
    paymentId: uuid('payment_id'),
    /** Applicant or staff who last saved while status=draft. */
    savedByUserId: uuid('saved_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    assignedReviewerId: uuid('assigned_reviewer_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    submittedAt: timestamp('submitted_at'),
    completedAt: timestamp('completed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('passport_services_user_id_idx').on(table.userId),
    index('passport_services_listing_id_idx').on(table.passportListingId),
    index('passport_services_assigned_reviewer_id_idx').on(
      table.assignedReviewerId
    ),
    uniqueIndex('passport_services_reference_number_unique').on(
      table.referenceNumber
    ),
    uniqueIndex('passport_services_submit_id_unique').on(table.submitId),
    uniqueIndex('passport_services_one_draft_per_user_listing')
      .on(table.userId, table.passportListingId)
      .where(sql`${table.status} = 'draft'`),
  ]
);

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
 * Payments table.
 * application_id points at the draft/submitted application when known.
 * amount is paise.
 */
export const payments = pgTable(
  'payments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id)
      .notNull(),
    applicationId: uuid('application_id'),
    applicationType: varchar('application_type', { length: 50 }).notNull(), // 'visa' or 'passport'
    amount: integer('amount').notNull(), // in paise (smallest currency unit)
    currency: varchar('currency', { length: 10 }).notNull().default('INR'),
    /** pending | completed | failed | proceed | refunded */
    status: varchar('status', { length: 50 }).notNull().default('pending'),
    paymentMethod: varchar('payment_method', { length: 50 }), // upi, card, netbanking
    transactionId: varchar('transaction_id', { length: 255 }),
    metadata: jsonb('metadata'), // payment gateway response
    createdAt: timestamp('created_at').defaultNow().notNull(),
    completedAt: timestamp('completed_at'),
    razorpayOrderId: varchar('razorpay_order_id', { length: 255 }),
    razorpayPaymentId: varchar('razorpay_payment_id', { length: 255 }),
    /** charge (checkout capture) | refund (Razorpay refund row) */
    kind: varchar('kind', { length: 50 }).notNull().default('charge'),
    /** For kind=refund: points at the original capture payment. */
    parentPaymentId: uuid('parent_payment_id'),
    razorpayRefundId: varchar('razorpay_refund_id', { length: 255 }),
    /** Same client idempotency key as visa_applications.submit_id */
    submitId: uuid('submit_id'),
    priceOptionId: uuid('price_option_id'),
    governmentFeePaise: integer('government_fee_paise'),
    serviceFeePaise: integer('service_fee_paise'),
    gstFeePaise: integer('gst_fee_paise'),
    travellerCount: integer('traveller_count'),
  },
  (table) => [
    foreignKey({
      columns: [table.parentPaymentId],
      foreignColumns: [table.id],
      name: 'payments_parent_payment_id_payments_id_fk',
    }),
    uniqueIndex('payments_razorpay_order_id_unique')
      .on(table.razorpayOrderId)
      .where(
        sql`${table.razorpayOrderId} IS NOT NULL AND ${table.kind} = 'charge'`
      ),
    uniqueIndex('payments_razorpay_payment_id_unique')
      .on(table.razorpayPaymentId)
      .where(
        sql`${table.razorpayPaymentId} IS NOT NULL AND ${table.kind} = 'charge'`
      ),
    uniqueIndex('payments_razorpay_refund_id_unique').on(table.razorpayRefundId),
    uniqueIndex('payments_one_pending_per_submit')
      .on(table.submitId)
      .where(sql`${table.status} = 'pending'`),
    index('payments_user_created_at_idx').on(table.userId, table.createdAt),
    index('payments_application_id_idx').on(table.applicationId),
    index('payments_submit_id_idx').on(table.submitId),
    index('payments_parent_payment_id_idx').on(table.parentPaymentId),
  ]
);

/**
 * Application Status History - tracks status changes
 */
export const statusHistory = pgTable(
  'status_history',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    applicationId: uuid('application_id').notNull(),
    applicationType: varchar('application_type', { length: 50 }).notNull(),
    /** Null for passport and for visa events that apply to the whole file. */
    travellerId: uuid('traveller_id').references(() => visaApplicationTravellers.id, {
      onDelete: 'set null',
    }),
    oldStatus: varchar('old_status', { length: 50 }),
    newStatus: varchar('new_status', { length: 50 }).notNull(),
    changedBy: uuid('changed_by').references(() => users.id),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('status_history_traveller_id_idx').on(table.travellerId),
  ]
);

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

/**
 * One portal login per visa or passport application.
 * Username is plaintext for staff display. Password is AES-256-GCM ciphertext only.
 */
export const applicationCredentials = pgTable(
  'application_credentials',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    applicationId: uuid('application_id').notNull(),
    applicationType: varchar('application_type', { length: 50 }).notNull(),
    username: varchar('username', { length: 255 }).notNull(),
    passwordCiphertext: text('password_ciphertext').notNull(),
    passwordIv: varchar('password_iv', { length: 32 }).notNull(),
    keyVersion: integer('key_version').notNull().default(1),
    createdBy: uuid('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    updatedBy: uuid('updated_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('application_credentials_application_unique').on(
      table.applicationId,
      table.applicationType
    ),
  ]
);

/**
 * Append-only audit of each time staff copy a portal password.
 */
export const applicationCredentialReveals = pgTable(
  'application_credential_reveals',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    credentialId: uuid('credential_id')
      .references(() => applicationCredentials.id, { onDelete: 'cascade' })
      .notNull(),
    revealedBy: uuid('revealed_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('application_credential_reveals_credential_id_idx').on(
      table.credentialId
    ),
  ]
);

/**
 * Public two-way thread between the applicant and staff.
 * Private staff notes stay in application_notes.
 */
export const applicationComments = pgTable(
  'application_comments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    applicationId: uuid('application_id').notNull(),
    travellerId: uuid('traveller_id').references(() => visaApplicationTravellers.id, {
      onDelete: 'set null',
    }),
    authorId: uuid('author_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    authorRole: varchar('author_role', { length: 20 }).notNull(),
    body: text('body').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('application_comments_application_id_idx').on(table.applicationId),
  ]
);

/**
 * One correction round per traveller. Staff ask for specific reuploads or field fixes.
 */
export const correctionRequests = pgTable(
  'correction_requests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /** Polymorphic: visa_applications.id or passport_services.id */
    applicationId: uuid('application_id').notNull(),
    applicationType: varchar('application_type', { length: 50 })
      .notNull()
      .default('visa'),
    travellerId: uuid('traveller_id').references(
      () => visaApplicationTravellers.id,
      { onDelete: 'cascade' }
    ),
    requestedBy: uuid('requested_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    message: text('message').notNull(),
    status: varchar('status', { length: 20 }).notNull().default('open'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    resubmittedAt: timestamp('resubmitted_at'),
    resolvedAt: timestamp('resolved_at'),
  },
  (table) => [
    index('correction_requests_application_id_idx').on(table.applicationId),
    index('correction_requests_application_type_idx').on(
      table.applicationType,
      table.applicationId
    ),
    index('correction_requests_traveller_status_idx').on(
      table.travellerId,
      table.status
    ),
  ]
);

/**
 * Append-only log of a staff member correcting a traveller field or document.
 * Separate from correction_requests, which ask the applicant to make the change.
 */
export const staffFieldEdits = pgTable(
  'staff_field_edits',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /** Polymorphic: visa_applications.id or passport_services.id */
    applicationId: uuid('application_id').notNull(),
    applicationType: varchar('application_type', { length: 50 })
      .notNull()
      .default('visa'),
    travellerId: uuid('traveller_id').references(
      () => visaApplicationTravellers.id,
      { onDelete: 'cascade' }
    ),
    actorId: uuid('actor_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    kind: varchar('kind', { length: 20 }).notNull(),
    targetKey: varchar('target_key', { length: 200 }).notNull(),
    message: text('message').notNull(),
    previousValue: jsonb('previous_value'),
    newValue: jsonb('new_value'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('staff_field_edits_application_id_idx').on(table.applicationId),
    index('staff_field_edits_application_type_idx').on(
      table.applicationType,
      table.applicationId
    ),
  ]
);

/** One document slot or form field the applicant must change. */
export const correctionItems = pgTable(
  'correction_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    requestId: uuid('request_id')
      .references(() => correctionRequests.id, { onDelete: 'cascade' })
      .notNull(),
    kind: varchar('kind', { length: 20 }).notNull(),
    targetKey: varchar('target_key', { length: 200 }).notNull(),
    comment: text('comment').notNull(),
    status: varchar('status', { length: 20 }).notNull().default('open'),
    previousValue: jsonb('previous_value'),
    newValue: jsonb('new_value'),
  },
  (table) => [
    index('correction_items_request_id_idx').on(table.requestId),
  ]
);

/** In-app alerts. Email is sent from the same event and is not stored here. */
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    applicationId: uuid('application_id'),
    type: varchar('type', { length: 50 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    body: text('body').notNull(),
    href: varchar('href', { length: 500 }).notNull(),
    readAt: timestamp('read_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('notifications_user_read_idx').on(table.userId, table.readAt),
  ]
);

// Export types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type VisaApplication = typeof visaApplications.$inferSelect;
export type NewVisaApplication = typeof visaApplications.$inferInsert;

export type VisaApplicationTraveller = typeof visaApplicationTravellers.$inferSelect;
export type NewVisaApplicationTraveller =
  typeof visaApplicationTravellers.$inferInsert;

export type PassportService = typeof passportServices.$inferSelect;
export type NewPassportService = typeof passportServices.$inferInsert;

export type PassportFormVersion = typeof passportFormVersions.$inferSelect;
export type NewPassportFormVersion = typeof passportFormVersions.$inferInsert;

export type {
  PassportListing,
  NewPassportListing,
  PassportListingPrice,
  NewPassportListingPrice,
  PassportFormStep,
  NewPassportFormStep,
  PassportAdditionalQuestion,
  NewPassportAdditionalQuestion,
  PassportComponentRequired,
  NewPassportComponentRequired,
  PassportFaq,
  NewPassportFaq,
} from './schema-passport';

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;

export type StatusHistory = typeof statusHistory.$inferSelect;
export type NewStatusHistory = typeof statusHistory.$inferInsert;

export type FormVersion = typeof formVersions.$inferSelect;
export type NewFormVersion = typeof formVersions.$inferInsert;

export type ApplicationCallLog = typeof applicationCallLogs.$inferSelect;
export type NewApplicationCallLog = typeof applicationCallLogs.$inferInsert;

export type ApplicationNote = typeof applicationNotes.$inferSelect;
export type NewApplicationNote = typeof applicationNotes.$inferInsert;

export type ApplicationCredential = typeof applicationCredentials.$inferSelect;
export type NewApplicationCredential = typeof applicationCredentials.$inferInsert;

export type ApplicationCredentialReveal =
  typeof applicationCredentialReveals.$inferSelect;
export type NewApplicationCredentialReveal =
  typeof applicationCredentialReveals.$inferInsert;

export type ApplicationComment = typeof applicationComments.$inferSelect;
export type NewApplicationComment = typeof applicationComments.$inferInsert;

export type CorrectionRequest = typeof correctionRequests.$inferSelect;
export type NewCorrectionRequest = typeof correctionRequests.$inferInsert;

export type CorrectionItem = typeof correctionItems.$inferSelect;
export type NewCorrectionItem = typeof correctionItems.$inferInsert;

export type StaffFieldEdit = typeof staffFieldEdits.$inferSelect;
export type NewStaffFieldEdit = typeof staffFieldEdits.$inferInsert;

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;

export type { VisaListing, NewVisaListing } from './schema-extended';
