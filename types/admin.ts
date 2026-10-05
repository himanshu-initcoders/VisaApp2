import { User, VisaApplication, PassportService, Document } from '@/lib/db/schema';

/**
 * Admin Panel Type Definitions
 *
 * These types support admin operations including:
 * - Application listing with filters
 * - Application detail views
 * - Document verification
 * - Status history tracking
 */

/**
 * Combined application type for list display
 * Unifies visa and passport applications into single table view
 */
export interface ApplicationListItem {
  id: string;
  type: 'visa' | 'passport';
  userId: string;
  userName: string;
  userEmail: string;
  userPhone?: string | null;
  status: string;
  /** Visa files only. Used for the "2 of 3 approved" line. */
  travellerCount?: number;
  approvedTravellerCount?: number;
  submittedAt: Date | null;
  createdAt: Date;
  // Visa-specific fields
  country?: string | null;
  countryCode?: string | null;
  visaType?: string | null;
  applicantName?: string | null;
  applicantPhone?: string | null;
  passengerNames?: string | null;
  formVersionId?: string | null;
  formVersionNumber?: number | null;
  // Passport-specific fields
  serviceType?: string;
  /** Visa applications only. */
  assignedReviewerId?: string | null;
  assignedReviewerName?: string | null;
}

/**
 * Reviewer option for the assign dialog (max 5).
 */
export interface ReviewerOption {
  id: string;
  name: string;
  email: string;
  /** Assigned visa applications that are not draft, approved, or rejected. */
  openCount: number;
}

/**
 * Filter criteria for applications list
 */
export interface ApplicationFilters {
  status?: string; // draft, submitted, under_review, approved, rejected, partially_approved
  type?: 'visa' | 'passport' | 'all';
  search?: string; // search by applicant / user name
  phone?: string; // mobile (last 10 digits)
  country?: string; // legacy single ISO2 country code
  countryCodes?: string[]; // fully selected countries (all visas)
  visaListingIds?: string[]; // partial visa listing selections
  passenger?: string; // passenger name ILIKE
  dateFrom?: string; // ISO date string (IST day start)
  dateTo?: string; // ISO date string (IST day end)
  userId?: string; // filter by specific user
  page?: number;
  limit?: number;
  sortBy?: 'submittedAt' | 'createdAt' | 'status';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated response for applications list
 */
export interface PaginatedApplications {
  applications: ApplicationListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApplicationPaymentItem {
  id: string;
  amount: number;
  currency: string;
  status: string;
  paymentMethod: string | null;
  razorpayPaymentId: string | null;
  razorpayOrderId: string | null;
  createdAt: Date;
  completedAt: Date | null;
  /** Shown on the account dashboard, where payments span applications. */
  label?: string | null;
  href?: string | null;
}

/**
 * Full application details with all related data
 */
export interface ApplicationDetail {
  application: VisaApplication | PassportService;
  type: 'visa' | 'passport';
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
  };
  documents: DocumentWithVerification[];
  statusHistory: StatusHistoryItem[];
  /** Visa traveller rows. Empty for passport. */
  travellers: VisaTravellerStatus[];
  notes: NoteItem[];
  callLogs: CallLogItem[];
  payments: ApplicationPaymentItem[];
  formVersionNumber?: number | null;
  /** Visa applications only. Null when unassigned or for passport. */
  assignedReviewer: {
    id: string;
    name: string;
    email: string;
  } | null;
}

/**
 * Document with verification metadata
 */
export interface DocumentWithVerification {
  id: string;
  applicationId: string;
  applicationType: string;
  documentType: string;
  s3Key: string;
  filename: string;
  fileSize: number | null;
  mimeType: string | null;
  verified: boolean | null;
  verificationNotes: string | null;
  uploadedAt: Date;
}

/**
 * Status history item with user information
 */
export interface VisaTravellerStatus {
  id: string;
  applicationId: string;
  passengerId: string;
  name: string;
  status: string;
}

export interface StatusHistoryItem {
  id: string;
  applicationId: string;
  applicationType: string;
  travellerId: string | null;
  oldStatus: string | null;
  newStatus: string;
  changedBy: string | null;
  changedByName: string | null;
  notes: string | null;
  createdAt: Date;
}

/**
 * Internal note on an application
 */
export interface NoteItem {
  id: string;
  applicationId: string;
  applicationType: string;
  note: string;
  addedBy: string | null;
  addedByName: string | null;
  createdAt: Date;
}

/**
 * Append-only call log entry
 */
export interface CallLogItem {
  id: string;
  applicationId: string;
  phone: string;
  note: string;
  adminUserId: string | null;
  adminName: string;
  createdAt: Date;
}

/**
 * User with application statistics
 */
export interface UserWithStats {
  id: string;
  name: string;
  email: string;
  role: string;
  emailVerified: Date | null;
  createdAt: Date;
  visaApplicationsCount: number;
  passportApplicationsCount: number;
  totalApplicationsCount: number;
}

/**
 * Paginated users response
 */
export interface PaginatedUsers {
  users: UserWithStats[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Server Action response type
 */
export interface ActionResponse<T = void> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

/**
 * Status update request
 */
export interface StatusUpdateRequest {
  applicationId: string;
  applicationType: 'visa' | 'passport';
  /** Required for visa. The visa_application_travellers row being updated. */
  travellerId?: string;
  newStatus: string;
  notes?: string;
}

/**
 * Document verification request
 */
export interface DocumentVerificationRequest {
  documentId: string;
  verified: boolean;
  notes?: string;
}

/**
 * Add note request
 */
export interface AddNoteRequest {
  applicationId: string;
  applicationType: 'visa' | 'passport';
  note: string;
}

/**
 * Add call log request
 */
export interface AddCallLogRequest {
  applicationId: string;
  phone: string;
  note: string;
}

/**
 * Update user role request
 */
export interface UpdateUserRoleRequest {
  userId: string;
  newRole: 'user' | 'admin' | 'reviewer';
}

/**
 * Account shown on the admin user detail page.
 */
export interface AdminUserProfile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  emailVerified: Date | null;
  createdAt: Date;
  deactivatedAt: Date | null;
}

/**
 * Deactivate or restore a non-admin account.
 */
export interface SetUserDeactivatedRequest {
  userId: string;
  deactivated: boolean;
}

/**
 * Visa or passport application row on a user detail page.
 */
export interface UserApplicationSummary {
  id: string;
  type: 'visa' | 'passport';
  title: string;
  detail: string;
  status: string;
  travellerCount?: number;
  approvedTravellerCount?: number;
  submittedAt: Date | null;
  createdAt: Date;
}

/**
 * One passenger (or the Other bucket) and the files that belong to them.
 */
export interface UserPassengerDocumentGroup {
  id: string;
  label: string;
  documents: DocumentWithVerification[];
}

export interface UserPassengerDocuments {
  passengers: UserPassengerDocumentGroup[];
  otherDocuments: DocumentWithVerification[];
}

/**
 * One reviewer action: a call log, a note, or a status change.
 */
export interface ReviewerActivityItem {
  id: string;
  kind: 'call' | 'note' | 'status';
  applicationId: string;
  applicationType: 'visa' | 'passport';
  applicationLabel: string;
  createdAt: Date;
  body: string;
  phone?: string;
  oldStatus?: string | null;
  newStatus?: string | null;
}
