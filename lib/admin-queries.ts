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
} from '@/lib/db/schema';
import { eq, and, or, like, gte, lte, desc, sql, count, ilike, inArray } from 'drizzle-orm';
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
    passenger,
    dateFrom,
    dateTo,
    userId,
    page = 1,
    limit = 20,
    sortBy = 'submittedAt',
    sortOrder = 'desc',
  } = filters;

  const phoneDigits = phone ? last10Digits(phone) : '';

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
    if (country) {
      visaConditions.push(
        eq(visaApplications.countryCode, country.toUpperCase())
      );
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
      })
      .from(visaApplications)
      .innerJoin(users, eq(visaApplications.userId, users.id))
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
    }));
  }

  // Fetch passport applications (legacy filters only — no Phase 3 denorm)
  let passportApps: ApplicationListItem[] = [];
  if (
    (type === 'all' || type === 'passport') &&
    !country &&
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

  return {
    applications: paginatedApps,
    total,
    page,
    limit,
    totalPages,
  };
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
      })
      .from(visaApplications)
      .innerJoin(users, eq(visaApplications.userId, users.id))
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

  return {
    application,
    type,
    user,
    documents: docs,
    statusHistory: history,
    notes,
    callLogs,
    formVersionNumber,
  };
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
