import { db } from '@/lib/db';
import {
  users,
  visaApplications,
  passportServices,
  documents,
  statusHistory,
  applicationNotes,
  applicationCallLogs,
  formVersions,
  visaApplicationTravellers,
  payments,
} from '@/lib/db/schema';
import { eq, and, or, like, gte, lte, desc, sql, count, ilike, inArray } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { loadTravellerSummaries } from '@/lib/visa/travellerStatus';
import { passengerProfileKey } from '@/lib/dashboard/passengerProfiles';
import type {
  ApplicationListItem,
  ApplicationFilters,
  PaginatedApplications,
  ApplicationDetail,
  DocumentWithVerification,
  StatusHistoryItem,
  NoteItem,
  CallLogItem,
  UserWithStats,
  PaginatedUsers,
  AdminUserProfile,
  UserApplicationSummary,
  UserPassengerDocuments,
  UserPassengerDocumentGroup,
  ReviewerActivityItem,
} from '@/types/admin';

/**
 * Admin Query Utilities
 *
 * Reusable database queries for admin panel operations
 * All queries use Drizzle ORM for type safety
 */

/** IST day bounds for submittedAt filters (store timestamptz, filter in IST). */
function istDayStartUtc(isoDate: string): Date {
  // isoDate = YYYY-MM-DD; IST = UTC+5:30
  return new Date(`${isoDate}T00:00:00+05:30`);
}

function istDayEndUtc(isoDate: string): Date {
  return new Date(`${isoDate}T23:59:59.999+05:30`);
}

function last10Digits(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  return digits.slice(-10);
}

/** Second users join so the applicant join stays `users`. */
const assignedReviewers = alias(users, 'assigned_reviewers');

/**
 * Get applications with filtering, sorting, and pagination
 */
export async function getApplicationsWithFilters(
  filters: ApplicationFilters
): Promise<PaginatedApplications> {
  const {
    status,
    type = 'all',
    search,
    phone,
    country,
    countryCodes,
    visaListingIds,
    passenger,
    dateFrom,
    dateTo,
    userId,
    assignedReviewerId,
    page = 1,
    limit = 20,
    sortBy = 'submittedAt',
    sortOrder = 'desc',
  } = filters;

  const phoneDigits = phone ? last10Digits(phone) : '';
  const selectedCountryCodes = [
    ...new Set(
      [...(countryCodes ?? []), ...(country ? [country] : [])]
        .map((code) => code.trim().toUpperCase())
        .filter((code) => code.length === 2)
    ),
  ];
  const selectedListingIds = [
    ...new Set((visaListingIds ?? []).map((id) => id.trim()).filter(Boolean)),
  ];
  const hasDestinationFilter =
    selectedCountryCodes.length > 0 || selectedListingIds.length > 0;

  // Fetch visa applications
  let visaApps: ApplicationListItem[] = [];
  if (type === 'all' || type === 'visa') {
    const visaConditions: ReturnType<typeof eq>[] = [];

    if (status) {
      visaConditions.push(eq(visaApplications.status, status));
    }
    if (userId) {
      visaConditions.push(eq(visaApplications.userId, userId));
    }
    if (assignedReviewerId) {
      visaConditions.push(
        eq(visaApplications.assignedReviewerId, assignedReviewerId)
      );
    }
    if (hasDestinationFilter) {
      const destinationMatch = [];
      if (selectedCountryCodes.length > 0) {
        destinationMatch.push(
          inArray(visaApplications.countryCode, selectedCountryCodes)
        );
      }
      if (selectedListingIds.length > 0) {
        destinationMatch.push(
          inArray(visaApplications.visaListingId, selectedListingIds)
        );
      }
      visaConditions.push(or(...destinationMatch)!);
    }
    if (dateFrom) {
      visaConditions.push(
        gte(visaApplications.submittedAt, istDayStartUtc(dateFrom))
      );
    }
    if (dateTo) {
      visaConditions.push(
        lte(visaApplications.submittedAt, istDayEndUtc(dateTo))
      );
    }
    if (search?.trim()) {
      const q = `%${search.trim()}%`;
      visaConditions.push(
        or(
          ilike(visaApplications.applicantName, q),
          ilike(users.name, q),
          ilike(users.email, q)
        )!
      );
    }
    if (passenger?.trim()) {
      visaConditions.push(
        ilike(visaApplications.passengerNames, `%${passenger.trim()}%`)
      );
    }
    if (phoneDigits.length >= 7) {
      const suffix = `%${phoneDigits}`;
      visaConditions.push(
        or(
          sql`regexp_replace(coalesce(${visaApplications.applicantPhone}, ''), '[^0-9]', '', 'g') like ${suffix}`,
          sql`regexp_replace(coalesce(${users.phone}, ''), '[^0-9]', '', 'g') like ${suffix}`
        )!
      );
    }

    const visaResults = await db
      .select({
        id: visaApplications.id,
        userId: visaApplications.userId,
        userName: users.name,
        userEmail: users.email,
        userPhone: users.phone,
        country: visaApplications.country,
        countryCode: visaApplications.countryCode,
        visaType: visaApplications.visaType,
        status: visaApplications.status,
        submittedAt: visaApplications.submittedAt,
        createdAt: visaApplications.createdAt,
        applicantName: visaApplications.applicantName,
        applicantPhone: visaApplications.applicantPhone,
        passengerNames: visaApplications.passengerNames,
        formVersionId: visaApplications.formVersionId,
        formVersionNumber: formVersions.version,
        assignedReviewerId: visaApplications.assignedReviewerId,
        assignedReviewerName: assignedReviewers.name,
      })
      .from(visaApplications)
      .innerJoin(users, eq(visaApplications.userId, users.id))
      .leftJoin(
        assignedReviewers,
        eq(visaApplications.assignedReviewerId, assignedReviewers.id)
      )
      .leftJoin(
        formVersions,
        eq(visaApplications.formVersionId, formVersions.id)
      )
      .where(visaConditions.length > 0 ? and(...visaConditions) : undefined);

    visaApps = visaResults.map((v) => ({
      id: v.id,
      type: 'visa' as const,
      userId: v.userId,
      userName: v.applicantName || v.userName,
      userEmail: v.userEmail,
      userPhone: v.applicantPhone || v.userPhone,
      status: v.status,
      submittedAt: v.submittedAt,
      createdAt: v.createdAt,
      country: v.country,
      countryCode: v.countryCode,
      visaType: v.visaType,
      applicantName: v.applicantName,
      applicantPhone: v.applicantPhone,
      passengerNames: v.passengerNames,
      formVersionId: v.formVersionId,
      formVersionNumber: v.formVersionNumber,
      assignedReviewerId: v.assignedReviewerId,
      assignedReviewerName: v.assignedReviewerName,
    }));
  }

  // Fetch passport applications (legacy filters only — no Phase 3 denorm)
  let passportApps: ApplicationListItem[] = [];
  if (
    (type === 'all' || type === 'passport') &&
    !assignedReviewerId &&
    !hasDestinationFilter &&
    !passenger &&
    !phoneDigits
  ) {
    const passportConditions: ReturnType<typeof eq>[] = [];

    if (status) {
      passportConditions.push(eq(passportServices.status, status));
    }
    if (userId) {
      passportConditions.push(eq(passportServices.userId, userId));
    }
    if (dateFrom) {
      passportConditions.push(
        gte(passportServices.submittedAt, istDayStartUtc(dateFrom))
      );
    }
    if (dateTo) {
      passportConditions.push(
        lte(passportServices.submittedAt, istDayEndUtc(dateTo))
      );
    }
    if (search?.trim()) {
      const q = `%${search.trim()}%`;
      passportConditions.push(
        or(ilike(users.name, q), ilike(users.email, q))!
      );
    }

    const passportResults = await db
      .select({
        id: passportServices.id,
        userId: passportServices.userId,
        userName: users.name,
        userEmail: users.email,
        userPhone: users.phone,
        serviceType: passportServices.serviceType,
        status: passportServices.status,
        submittedAt: passportServices.submittedAt,
        createdAt: passportServices.createdAt,
      })
      .from(passportServices)
      .innerJoin(users, eq(passportServices.userId, users.id))
      .where(
        passportConditions.length > 0 ? and(...passportConditions) : undefined
      );

    passportApps = passportResults.map((p) => ({
      id: p.id,
      type: 'passport' as const,
      userId: p.userId,
      userName: p.userName,
      userEmail: p.userEmail,
      userPhone: p.userPhone,
      status: p.status,
      submittedAt: p.submittedAt,
      createdAt: p.createdAt,
      serviceType: p.serviceType,
    }));
  }

  let allApps = [...visaApps, ...passportApps];

  allApps.sort((a, b) => {
    let aVal: number | string = 0;
    let bVal: number | string = 0;

    if (sortBy === 'submittedAt') {
      aVal = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
      bVal = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
    } else if (sortBy === 'createdAt') {
      aVal = new Date(a.createdAt).getTime();
      bVal = new Date(b.createdAt).getTime();
    } else if (sortBy === 'status') {
      aVal = a.status;
      bVal = b.status;
    }

    if (sortOrder === 'desc') {
      return bVal > aVal ? 1 : -1;
    }
    return aVal > bVal ? 1 : -1;
  });

  const total = allApps.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const offset = (page - 1) * limit;
  const paginatedApps = allApps.slice(offset, offset + limit);
  const applications = await attachVisaTravellerSummaries(paginatedApps);

  return {
    applications,
    total,
    page,
    limit,
    totalPages,
  };
}

async function attachVisaTravellerSummaries<
  T extends { id: string; type: 'visa' | 'passport' },
>(rows: T[]): Promise<Array<T & { travellerCount?: number; approvedTravellerCount?: number }>> {
  const visaIds = rows.filter((row) => row.type === 'visa').map((row) => row.id);
  const summaries = await loadTravellerSummaries(visaIds);
  return rows.map((row) => {
    if (row.type !== 'visa') return row;
    const summary = summaries.get(row.id);
    return {
      ...row,
      travellerCount: summary?.travellerCount ?? 0,
      approvedTravellerCount: summary?.approvedCount ?? 0,
    };
  });
}

export type VisaTripExportCells = {
  arrivalDate: string;
  returnDate: string;
  arrivalFlights: string;
  returnFlights: string;
  arrivalCity: string;
  hotel: string;
  stayAddress: string;
};

type ExportFlightLeg = { flightNumber?: string; date?: string };

type ExportTrip = {
  arrivalDate?: string;
  returnDate?: string;
  arrivalCity?: string;
  accommodationName?: string;
  accommodationAddress?: string;
  flightNumber?: string;
  arrivalFlightDate?: string;
  returnFlightNumber?: string;
  returnFlightDate?: string;
  arrivalFlights?: ExportFlightLeg[];
  returnFlights?: ExportFlightLeg[];
};

function formatFlightLegs(
  legs: ExportFlightLeg[] | undefined,
  fallbackNumber?: string,
  fallbackDate?: string
): string {
  const usable = Array.isArray(legs)
    ? legs
        .map((leg) =>
          [leg.flightNumber, leg.date].filter((part) => part?.trim()).join(' · ')
        )
        .filter(Boolean)
    : [];
  if (usable.length > 0) return usable.join(' -> ');
  return [fallbackNumber, fallbackDate].filter((part) => part?.trim()).join(' · ');
}

function summarizeVisaTrips(travellers: unknown): VisaTripExportCells {
  const list = Array.isArray(travellers) ? travellers : [];
  const named = list.length > 1;

  const joinField = (pick: (trip: ExportTrip) => string): string =>
    list
      .map((traveller) => {
        const row = traveller as {
          name?: string;
          tripDetails?: ExportTrip | null;
        };
        const value = pick(row.tripDetails || {});
        if (!value) return '';
        return named && row.name?.trim() ? `${row.name.trim()}: ${value}` : value;
      })
      .filter(Boolean)
      .join(' | ');

  return {
    arrivalDate: joinField((trip) => trip.arrivalDate?.trim() || ''),
    returnDate: joinField((trip) => trip.returnDate?.trim() || ''),
    arrivalCity: joinField((trip) => trip.arrivalCity?.trim() || ''),
    hotel: joinField((trip) => trip.accommodationName?.trim() || ''),
    stayAddress: joinField((trip) => trip.accommodationAddress?.trim() || ''),
    arrivalFlights: joinField((trip) =>
      formatFlightLegs(
        trip.arrivalFlights,
        trip.flightNumber,
        trip.arrivalFlightDate
      )
    ),
    returnFlights: joinField((trip) =>
      formatFlightLegs(
        trip.returnFlights,
        trip.returnFlightNumber,
        trip.returnFlightDate
      )
    ),
  };
}

const EMPTY_TRIP_EXPORT: VisaTripExportCells = {
  arrivalDate: '',
  returnDate: '',
  arrivalFlights: '',
  returnFlights: '',
  arrivalCity: '',
  hotel: '',
  stayAddress: '',
};

async function loadVisaTripExportCells(
  visaIds: string[]
): Promise<Map<string, VisaTripExportCells>> {
  const map = new Map<string, VisaTripExportCells>();
  if (visaIds.length === 0) return map;

  const rows = await db
    .select({
      id: visaApplications.id,
      travellers: visaApplications.travellers,
    })
    .from(visaApplications)
    .where(inArray(visaApplications.id, visaIds));

  for (const row of rows) {
    map.set(row.id, summarizeVisaTrips(row.travellers));
  }
  return map;
}

/**
 * Export applications matching filters (hard cap 5000).
 * Visa rows include trip cells loaded from travellers JSON.
 */
export async function getApplicationsForCsvExport(
  filters: ApplicationFilters,
  hardCap = 5000
): Promise<{
  rows: ApplicationListItem[];
  tripById: Map<string, VisaTripExportCells>;
  truncated: boolean;
  total: number;
}> {
  const result = await getApplicationsWithFilters({
    ...filters,
    page: 1,
    limit: hardCap + 1,
  });
  const truncated = result.applications.length > hardCap;
  const rows = result.applications.slice(0, hardCap);
  const visaIds = rows.filter((row) => row.type === 'visa').map((row) => row.id);
  const tripById = await loadVisaTripExportCells(visaIds);
  return {
    rows,
    tripById,
    truncated,
    total: result.total,
  };
}

export { EMPTY_TRIP_EXPORT };

/**
 * Get full application details with all related data
 */
export async function getApplicationDetails(
  id: string,
  type: 'visa' | 'passport'
): Promise<ApplicationDetail | null> {
  let application: ApplicationDetail['application'];
  let user: ApplicationDetail['user'];
  let formVersionNumber: number | null = null;
  let assignedReviewer: ApplicationDetail['assignedReviewer'] = null;

  if (type === 'visa') {
    const visaResult = await db
      .select({
        application: visaApplications,
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
          phone: users.phone,
        },
        formVersionNumber: formVersions.version,
        assignedReviewerId: assignedReviewers.id,
        assignedReviewerName: assignedReviewers.name,
        assignedReviewerEmail: assignedReviewers.email,
      })
      .from(visaApplications)
      .innerJoin(users, eq(visaApplications.userId, users.id))
      .leftJoin(
        assignedReviewers,
        eq(visaApplications.assignedReviewerId, assignedReviewers.id)
      )
      .leftJoin(
        formVersions,
        eq(visaApplications.formVersionId, formVersions.id)
      )
      .where(eq(visaApplications.id, id))
      .limit(1);

    if (!visaResult || visaResult.length === 0) {
      return null;
    }

    application = visaResult[0].application;
    user = visaResult[0].user;
    formVersionNumber = visaResult[0].formVersionNumber ?? null;
    if (visaResult[0].assignedReviewerId && visaResult[0].assignedReviewerName) {
      assignedReviewer = {
        id: visaResult[0].assignedReviewerId,
        name: visaResult[0].assignedReviewerName,
        email: visaResult[0].assignedReviewerEmail ?? '',
      };
    }
  } else {
    const passportResult = await db
      .select({
        application: passportServices,
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
          phone: users.phone,
        },
      })
      .from(passportServices)
      .innerJoin(users, eq(passportServices.userId, users.id))
      .where(eq(passportServices.id, id))
      .limit(1);

    if (!passportResult || passportResult.length === 0) {
      return null;
    }

    application = passportResult[0].application;
    user = passportResult[0].user;
  }

  const docs = await getDocumentsByApplicationId(id, type);
  const history = await getStatusHistoryByApplicationId(id, type);
  const notes = await getApplicationNotes(id);
  const callLogs = type === 'visa' ? await getApplicationCallLogs(id) : [];
  const travellers =
    type === 'visa' ? await getVisaTravellers(id) : [];
  const paymentRows = await db
    .select({
      id: payments.id,
      amount: payments.amount,
      currency: payments.currency,
      status: payments.status,
      paymentMethod: payments.paymentMethod,
      razorpayPaymentId: payments.razorpayPaymentId,
      razorpayOrderId: payments.razorpayOrderId,
      createdAt: payments.createdAt,
      completedAt: payments.completedAt,
    })
    .from(payments)
    .where(
      and(eq(payments.applicationId, id), eq(payments.applicationType, type))
    )
    .orderBy(desc(payments.createdAt));

  return {
    application,
    type,
    user,
    documents: docs,
    statusHistory: history,
    travellers,
    notes,
    callLogs,
    payments: paymentRows,
    formVersionNumber,
    assignedReviewer,
  };
}

export async function getVisaTravellers(applicationId: string) {
  return db
    .select({
      id: visaApplicationTravellers.id,
      applicationId: visaApplicationTravellers.applicationId,
      passengerId: visaApplicationTravellers.passengerId,
      name: visaApplicationTravellers.name,
      status: visaApplicationTravellers.status,
    })
    .from(visaApplicationTravellers)
    .where(eq(visaApplicationTravellers.applicationId, applicationId))
    .orderBy(visaApplicationTravellers.createdAt);
}

export async function getApplicationNotes(
  applicationId: string
): Promise<NoteItem[]> {
  const rows = await db
    .select()
    .from(applicationNotes)
    .where(eq(applicationNotes.applicationId, applicationId))
    .orderBy(desc(applicationNotes.createdAt));

  return rows.map((r) => ({
    id: r.id,
    applicationId: r.applicationId,
    applicationType: 'visa',
    note: r.body,
    addedBy: r.adminUserId,
    addedByName: r.adminName,
    createdAt: r.createdAt,
  }));
}

export async function getApplicationCallLogs(
  applicationId: string
): Promise<CallLogItem[]> {
  const rows = await db
    .select()
    .from(applicationCallLogs)
    .where(eq(applicationCallLogs.applicationId, applicationId))
    .orderBy(desc(applicationCallLogs.createdAt));

  return rows.map((r) => ({
    id: r.id,
    applicationId: r.applicationId,
    phone: r.phone,
    note: r.note,
    adminUserId: r.adminUserId,
    adminName: r.adminName,
    createdAt: r.createdAt,
  }));
}

/**
 * Get documents for an application
 */
export async function getDocumentsByApplicationId(
  applicationId: string,
  applicationType: 'visa' | 'passport'
): Promise<DocumentWithVerification[]> {
  const docs = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.applicationId, applicationId),
        eq(documents.applicationType, applicationType)
      )
    )
    .orderBy(desc(documents.uploadedAt));

  return docs as DocumentWithVerification[];
}

/**
 * Get status history for an application with user info
 */
export async function getStatusHistoryByApplicationId(
  applicationId: string,
  applicationType: 'visa' | 'passport'
): Promise<StatusHistoryItem[]> {
  const history = await db
    .select({
      id: statusHistory.id,
      applicationId: statusHistory.applicationId,
      applicationType: statusHistory.applicationType,
      travellerId: statusHistory.travellerId,
      oldStatus: statusHistory.oldStatus,
      newStatus: statusHistory.newStatus,
      changedBy: statusHistory.changedBy,
      changedByName: users.name,
      notes: statusHistory.notes,
      createdAt: statusHistory.createdAt,
    })
    .from(statusHistory)
    .leftJoin(users, eq(statusHistory.changedBy, users.id))
    .where(
      and(
        eq(statusHistory.applicationId, applicationId),
        eq(statusHistory.applicationType, applicationType)
      )
    )
    .orderBy(desc(statusHistory.createdAt));

  return history as StatusHistoryItem[];
}

/**
 * Get users with application statistics
 */
export async function getUsersWithApplicationCounts(
  searchQuery?: string,
  roleFilter?: string,
  page: number = 1,
  limit: number = 25
): Promise<PaginatedUsers> {
  const conditions: ReturnType<typeof eq>[] = [];

  if (searchQuery) {
    conditions.push(
      or(
        like(users.name, `%${searchQuery}%`),
        like(users.email, `%${searchQuery}%`)
      )!
    );
  }

  if (roleFilter && roleFilter !== 'all') {
    conditions.push(eq(users.role, roleFilter));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const totalResult = await db
    .select({ count: count() })
    .from(users)
    .where(whereClause);

  const total = totalResult[0]?.count || 0;

  const offset = (page - 1) * limit;
  const usersResult = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      emailVerified: users.emailVerified,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(whereClause)
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset);

  const usersWithStats: UserWithStats[] = await Promise.all(
    usersResult.map(async (user) => {
      const [visaCount, passportCount] = await Promise.all([
        db
          .select({ count: count() })
          .from(visaApplications)
          .where(eq(visaApplications.userId, user.id))
          .then((res) => res[0]?.count || 0),
        db
          .select({ count: count() })
          .from(passportServices)
          .where(eq(passportServices.userId, user.id))
          .then((res) => res[0]?.count || 0),
      ]);

      return {
        ...user,
        visaApplicationsCount: visaCount,
        passportApplicationsCount: passportCount,
        totalApplicationsCount: visaCount + passportCount,
      };
    })
  );

  const totalPages = Math.ceil(total / limit);

  return {
    users: usersWithStats,
    total,
    page,
    limit,
    totalPages,
  };
}

function toDocumentRow(
  row: typeof documents.$inferSelect
): DocumentWithVerification {
  return {
    id: row.id,
    applicationId: row.applicationId,
    applicationType: row.applicationType,
    documentType: row.documentType,
    s3Key: row.s3Key,
    filename: row.filename,
    fileSize: row.fileSize,
    mimeType: row.mimeType,
    verified: row.verified,
    verificationNotes: row.verificationNotes,
    uploadedAt: row.uploadedAt,
  };
}

/** Same passenger match as documentBelongsToTraveller. */
function documentBelongsToPassenger(s3Key: string, passengerId: string): boolean {
  if (!passengerId) return false;
  const needle = `/passengers/${passengerId}/`;
  if (s3Key.includes(needle)) return true;
  return s3Key.includes(passengerId);
}

type StoredPassenger = {
  passengerId?: string;
  name?: string;
  passportData?: Record<string, unknown> | null;
};

function asStoredTravellers(value: unknown): StoredPassenger[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const record = item as {
      passengerId?: unknown;
      name?: unknown;
      passportData?: unknown;
    };
    const passportData =
      record.passportData && typeof record.passportData === 'object'
        ? (record.passportData as Record<string, unknown>)
        : null;
    return [
      {
        passengerId:
          typeof record.passengerId === 'string' ? record.passengerId : undefined,
        name: typeof record.name === 'string' ? record.name : undefined,
        passportData,
      },
    ];
  });
}

/** Same slot and filename across visas is one file. Keep the newest upload. */
function documentFingerprint(doc: DocumentWithVerification): string {
  return `${doc.documentType.trim().toLowerCase()}:${doc.filename.trim().toLowerCase()}`;
}

function newerDocument(
  current: DocumentWithVerification,
  next: DocumentWithVerification
): DocumentWithVerification {
  return next.uploadedAt.getTime() >= current.uploadedAt.getTime() ? next : current;
}

function visaPlaceLabel(
  country: string | null,
  countryCode: string | null,
  visaType: string | null
): string {
  return country || countryCode || visaType || 'Visa';
}

function byNewestApplication(
  a: UserApplicationSummary,
  b: UserApplicationSummary
): number {
  const aTime = (a.submittedAt ?? a.createdAt).getTime();
  const bTime = (b.submittedAt ?? b.createdAt).getTime();
  return bTime - aTime;
}

/**
 * Load one account for the admin user detail page.
 */
export async function getAdminUserById(
  id: string
): Promise<AdminUserProfile | null> {
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      role: users.role,
      emailVerified: users.emailVerified,
      createdAt: users.createdAt,
      deactivatedAt: users.deactivatedAt,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Visa and passport applications owned by this user, newest first.
 */
export async function getApplicationsForUser(
  userId: string
): Promise<UserApplicationSummary[]> {
  const [visaRows, passportRows] = await Promise.all([
    db
      .select({
        id: visaApplications.id,
        country: visaApplications.country,
        countryCode: visaApplications.countryCode,
        visaType: visaApplications.visaType,
        status: visaApplications.status,
        submittedAt: visaApplications.submittedAt,
        createdAt: visaApplications.createdAt,
      })
      .from(visaApplications)
      .where(eq(visaApplications.userId, userId)),
    db
      .select({
        id: passportServices.id,
        serviceType: passportServices.serviceType,
        status: passportServices.status,
        submittedAt: passportServices.submittedAt,
        createdAt: passportServices.createdAt,
      })
      .from(passportServices)
      .where(eq(passportServices.userId, userId)),
  ]);

  const applications: UserApplicationSummary[] = await attachVisaTravellerSummaries([
    ...visaRows.map((row) => ({
      id: row.id,
      type: 'visa' as const,
      title: visaPlaceLabel(row.country, row.countryCode, row.visaType),
      detail: row.visaType,
      status: row.status,
      submittedAt: row.submittedAt,
      createdAt: row.createdAt,
    })),
    ...passportRows.map((row) => ({
      id: row.id,
      type: 'passport' as const,
      title: 'Passport',
      detail: row.serviceType,
      status: row.status,
      submittedAt: row.submittedAt,
      createdAt: row.createdAt,
    })),
  ]);

  applications.sort(byNewestApplication);
  return applications;
}

/**
 * One circle per person across this user's visa applications.
 * The same passport (or name + date of birth) on several visas is one person.
 * Files that share a slot and filename collapse to the newest upload.
 * Files with no passenger id, plus passport-service files, stay in Other.
 */
export async function getUserPassengerDocuments(
  userId: string
): Promise<UserPassengerDocuments> {
  const [visaRows, passportRows] = await Promise.all([
    db
      .select({
        id: visaApplications.id,
        country: visaApplications.country,
        countryCode: visaApplications.countryCode,
        visaType: visaApplications.visaType,
        travellers: visaApplications.travellers,
      })
      .from(visaApplications)
      .where(eq(visaApplications.userId, userId)),
    db
      .select({ id: passportServices.id })
      .from(passportServices)
      .where(eq(passportServices.userId, userId)),
  ]);

  const visaIds = visaRows.map((row) => row.id);
  const passportIds = passportRows.map((row) => row.id);

  const [visaDocs, passportDocs] = await Promise.all([
    visaIds.length > 0
      ? db
          .select()
          .from(documents)
          .where(
            and(
              inArray(documents.applicationId, visaIds),
              eq(documents.applicationType, 'visa')
            )
          )
      : Promise.resolve([]),
    passportIds.length > 0
      ? db
          .select()
          .from(documents)
          .where(
            and(
              inArray(documents.applicationId, passportIds),
              eq(documents.applicationType, 'passport')
            )
          )
      : Promise.resolve([]),
  ]);

  const visaDocuments = visaDocs.map(toDocumentRow);
  const claimed = new Set<string>();
  const groups = new Map<
    string,
    {
      id: string;
      label: string;
      documents: Map<string, DocumentWithVerification>;
    }
  >();

  for (const visa of visaRows) {
    const travellers = asStoredTravellers(visa.travellers);

    travellers.forEach((traveller, index) => {
      const id = passengerProfileKey(traveller);
      const name = traveller.name?.trim() || `Traveller ${index + 1}`;
      let group = groups.get(id);
      if (!group) {
        group = { id, label: name, documents: new Map() };
        groups.set(id, group);
      } else if (name && !/^traveller \d+$/i.test(name)) {
        group.label = name;
      }

      const passengerId = traveller.passengerId?.trim() ?? '';
      if (!passengerId) return;

      const matched = visaDocuments.filter(
        (doc) =>
          !claimed.has(doc.id) &&
          documentBelongsToPassenger(doc.s3Key, passengerId)
      );

      for (const doc of matched) {
        claimed.add(doc.id);
        const fingerprint = documentFingerprint(doc);
        const existing = group.documents.get(fingerprint);
        group.documents.set(
          fingerprint,
          existing ? newerDocument(existing, doc) : doc
        );
      }
    });
  }

  const passengers: UserPassengerDocumentGroup[] = [...groups.values()]
    .map((group) => ({
      id: group.id,
      label: group.label,
      documents: [...group.documents.values()].sort(
        (a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime()
      ),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const otherDocuments = [
    ...visaDocuments.filter((doc) => !claimed.has(doc.id)),
    ...passportDocs.map(toDocumentRow),
  ];

  return { passengers, otherDocuments };
}

/**
 * Visa applications assigned to this reviewer, newest first.
 */
export async function getVisaApplicationsAssignedToReviewer(
  reviewerId: string
): Promise<UserApplicationSummary[]> {
  const rows = await db
    .select({
      id: visaApplications.id,
      country: visaApplications.country,
      countryCode: visaApplications.countryCode,
      visaType: visaApplications.visaType,
      applicantName: visaApplications.applicantName,
      status: visaApplications.status,
      submittedAt: visaApplications.submittedAt,
      createdAt: visaApplications.createdAt,
    })
    .from(visaApplications)
    .where(eq(visaApplications.assignedReviewerId, reviewerId));

  const applications: UserApplicationSummary[] = await attachVisaTravellerSummaries(
    rows.map((row) => ({
      id: row.id,
      type: 'visa' as const,
      title: visaPlaceLabel(row.country, row.countryCode, row.visaType),
      detail: row.applicantName?.trim() || row.visaType,
      status: row.status,
      submittedAt: row.submittedAt,
      createdAt: row.createdAt,
    }))
  );

  applications.sort(byNewestApplication);
  return applications;
}

function visaActivityLabel(row: {
  country: string | null;
  countryCode: string | null;
  visaType: string | null;
  applicantName: string | null;
}): string {
  const place = row.country || row.countryCode || 'Visa';
  const type = row.visaType ? ` — ${row.visaType}` : '';
  const who = row.applicantName?.trim() ? ` · ${row.applicantName.trim()}` : '';
  return `${place}${type}${who}`;
}

/**
 * Call logs, notes, and status changes made by this reviewer, newest first.
 */
export async function getReviewerActivity(
  reviewerId: string
): Promise<ReviewerActivityItem[]> {
  const [calls, notes, changes] = await Promise.all([
    db
      .select({
        id: applicationCallLogs.id,
        applicationId: applicationCallLogs.applicationId,
        phone: applicationCallLogs.phone,
        note: applicationCallLogs.note,
        createdAt: applicationCallLogs.createdAt,
        country: visaApplications.country,
        countryCode: visaApplications.countryCode,
        visaType: visaApplications.visaType,
        applicantName: visaApplications.applicantName,
      })
      .from(applicationCallLogs)
      .leftJoin(
        visaApplications,
        eq(applicationCallLogs.applicationId, visaApplications.id)
      )
      .where(eq(applicationCallLogs.adminUserId, reviewerId)),
    db
      .select({
        id: applicationNotes.id,
        applicationId: applicationNotes.applicationId,
        body: applicationNotes.body,
        createdAt: applicationNotes.createdAt,
        country: visaApplications.country,
        countryCode: visaApplications.countryCode,
        visaType: visaApplications.visaType,
        applicantName: visaApplications.applicantName,
      })
      .from(applicationNotes)
      .leftJoin(
        visaApplications,
        eq(applicationNotes.applicationId, visaApplications.id)
      )
      .where(eq(applicationNotes.adminUserId, reviewerId)),
    db
      .select({
        id: statusHistory.id,
        applicationId: statusHistory.applicationId,
        applicationType: statusHistory.applicationType,
        oldStatus: statusHistory.oldStatus,
        newStatus: statusHistory.newStatus,
        notes: statusHistory.notes,
        createdAt: statusHistory.createdAt,
        country: visaApplications.country,
        countryCode: visaApplications.countryCode,
        visaType: visaApplications.visaType,
        applicantName: visaApplications.applicantName,
        serviceType: passportServices.serviceType,
      })
      .from(statusHistory)
      .leftJoin(
        visaApplications,
        eq(statusHistory.applicationId, visaApplications.id)
      )
      .leftJoin(
        passportServices,
        eq(statusHistory.applicationId, passportServices.id)
      )
      .where(eq(statusHistory.changedBy, reviewerId)),
  ]);

  const items: ReviewerActivityItem[] = [
    ...calls.map((row) => ({
      id: `call-${row.id}`,
      kind: 'call' as const,
      applicationId: row.applicationId,
      applicationType: 'visa' as const,
      applicationLabel: visaActivityLabel(row),
      createdAt: row.createdAt,
      body: row.note,
      phone: row.phone,
    })),
    ...notes.map((row) => ({
      id: `note-${row.id}`,
      kind: 'note' as const,
      applicationId: row.applicationId,
      applicationType: 'visa' as const,
      applicationLabel: visaActivityLabel(row),
      createdAt: row.createdAt,
      body: row.body,
    })),
    ...changes.map((row) => {
      const applicationType: 'visa' | 'passport' =
        row.applicationType === 'passport' ? 'passport' : 'visa';
      const applicationLabel =
        applicationType === 'passport'
          ? row.serviceType
            ? `Passport · ${row.serviceType}`
            : 'Passport'
          : visaActivityLabel(row);

      return {
        id: `status-${row.id}`,
        kind: 'status' as const,
        applicationId: row.applicationId,
        applicationType,
        applicationLabel,
        createdAt: row.createdAt,
        body: row.notes?.trim() || '',
        oldStatus: row.oldStatus,
        newStatus: row.newStatus,
      };
    }),
  ];

  items.sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );
  return items;
}
