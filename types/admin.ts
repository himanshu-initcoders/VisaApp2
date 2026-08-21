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
  status: string;
  submittedAt: Date | null;
  createdAt: Date;
  // Visa-specific fields
  country?: string;
  visaType?: string;
  // Passport-specific fields
  serviceType?: string;
}

/**
 * Filter criteria for applications list
 */
export interface ApplicationFilters {
  status?: string; // draft, submitted, under_review, approved, rejected
  type?: 'visa' | 'passport' | 'all';
  search?: string; // search by user name or email
  dateFrom?: string; // ISO date string
  dateTo?: string; // ISO date string
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
  notes: NoteItem[];
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
export interface StatusHistoryItem {
  id: string;
  applicationId: string;
  applicationType: string;
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
 * Update user role request
 */
export interface UpdateUserRoleRequest {
  userId: string;
  newRole: 'user' | 'admin' | 'reviewer';
}
