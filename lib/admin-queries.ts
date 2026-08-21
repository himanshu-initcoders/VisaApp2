import { db } from '@/lib/db';
import {
  users,
  visaApplications,
  passportServices,
  documents,
  statusHistory,
} from '@/lib/db/schema';
import { eq, and, or, like, gte, lte, desc, asc, sql, count } from 'drizzle-orm';
import type {
  ApplicationListItem,
  ApplicationFilters,
  PaginatedApplications,
  ApplicationDetail,
  DocumentWithVerification,
  StatusHistoryItem,
  NoteItem,
  UserWithStats,
  PaginatedUsers,
} from '@/types/admin';

/**
 * Admin Query Utilities
 *
 * Reusable database queries for admin panel operations
 * All queries use Drizzle ORM for type safety
 */

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
    dateFrom,
    dateTo,
    userId,
    page = 1,
    limit = 25,
    sortBy = 'submittedAt',
    sortOrder = 'desc',
  } = filters;

  // Build conditions array
  const conditions: any[] = [];

  // Status filter
  if (status) {
    conditions.push(eq(visaApplications.status, status));
  }

  // User filter
  if (userId) {
    conditions.push(eq(visaApplications.userId, userId));
  }

  // Date range filter
  if (dateFrom) {
    conditions.push(gte(visaApplications.submittedAt, new Date(dateFrom)));
  }
  if (dateTo) {
    conditions.push(lte(visaApplications.submittedAt, new Date(dateTo)));
  }

  // Fetch visa applications
  let visaApps: ApplicationListItem[] = [];
  if (type === 'all' || type === 'visa') {
    const visaConditions = [...conditions];
    if (search) {
      visaConditions.push(
        or(
          like(users.name, `%${search}%`),
          like(users.email, `%${search}%`)
        )
      );
    }

    const visaResults = await db
      .select({
        id: visaApplications.id,
        userId: visaApplications.userId,
        userName: users.name,
        userEmail: users.email,
        country: visaApplications.country,
        visaType: visaApplications.visaType,
        status: visaApplications.status,
        submittedAt: visaApplications.submittedAt,
        createdAt: visaApplications.createdAt,
      })
      .from(visaApplications)
      .innerJoin(users, eq(visaApplications.userId, users.id))
      .where(visaConditions.length > 0 ? and(...visaConditions) : undefined);

    visaApps = visaResults.map((v) => ({
      id: v.id,
      type: 'visa' as const,
      userId: v.userId,
      userName: v.userName,
      userEmail: v.userEmail,
      status: v.status,
      submittedAt: v.submittedAt,
      createdAt: v.createdAt,
      country: v.country,
      visaType: v.visaType,
    }));
  }

  // Fetch passport applications
  let passportApps: ApplicationListItem[] = [];
  if (type === 'all' || type === 'passport') {
    const passportConditions: any[] = [];

    if (status) {
      passportConditions.push(eq(passportServices.status, status));
    }
    if (userId) {
      passportConditions.push(eq(passportServices.userId, userId));
    }
    if (dateFrom) {
      passportConditions.push(gte(passportServices.submittedAt, new Date(dateFrom)));
    }
    if (dateTo) {
      passportConditions.push(lte(passportServices.submittedAt, new Date(dateTo)));
    }
    if (search) {
      passportConditions.push(
        or(
          like(users.name, `%${search}%`),
          like(users.email, `%${search}%`)
        )
      );
    }

    const passportResults = await db
      .select({
        id: passportServices.id,
        userId: passportServices.userId,
        userName: users.name,
        userEmail: users.email,
        serviceType: passportServices.serviceType,
        status: passportServices.status,
        submittedAt: passportServices.submittedAt,
        createdAt: passportServices.createdAt,
      })
      .from(passportServices)
      .innerJoin(users, eq(passportServices.userId, users.id))
      .where(passportConditions.length > 0 ? and(...passportConditions) : undefined);

    passportApps = passportResults.map((p) => ({
      id: p.id,
      type: 'passport' as const,
      userId: p.userId,
      userName: p.userName,
      userEmail: p.userEmail,
      status: p.status,
      submittedAt: p.submittedAt,
      createdAt: p.createdAt,
      serviceType: p.serviceType,
    }));
  }

  // Combine and sort
  let allApps = [...visaApps, ...passportApps];

  // Sort
  allApps.sort((a, b) => {
    let aVal: any, bVal: any;

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
    } else {
      return aVal > bVal ? 1 : -1;
    }
  });

  // Pagination
  const total = allApps.length;
  const totalPages = Math.ceil(total / limit);
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

/**
 * Get full application details with all related data
 */
export async function getApplicationDetails(
  id: string,
  type: 'visa' | 'passport'
): Promise<ApplicationDetail | null> {
  // Fetch application
  let application: any;
  let user: any;

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
      })
      .from(visaApplications)
      .innerJoin(users, eq(visaApplications.userId, users.id))
      .where(eq(visaApplications.id, id))
      .limit(1);

    if (!visaResult || visaResult.length === 0) {
      return null;
    }

    application = visaResult[0].application;
    user = visaResult[0].user;
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

  // Fetch documents
  const docs = await getDocumentsByApplicationId(id, type);

  // Fetch status history
  const history = await getStatusHistoryByApplicationId(id, type);

  // Extract notes from status history (notes with no status change)
  const notes: NoteItem[] = history
    .filter((h) => h.notes && h.notes.trim() !== '')
    .map((h) => ({
      id: h.id,
      applicationId: h.applicationId,
      applicationType: h.applicationType,
      note: h.notes || '',
      addedBy: h.changedBy,
      addedByName: h.changedByName,
      createdAt: h.createdAt,
    }));

  return {
    application,
    type,
    user,
    documents: docs,
    statusHistory: history,
    notes,
  };
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
  const conditions: any[] = [];

  if (searchQuery) {
    conditions.push(
      or(
        like(users.name, `%${searchQuery}%`),
        like(users.email, `%${searchQuery}%`)
      )
    );
  }

  if (roleFilter && roleFilter !== 'all') {
    conditions.push(eq(users.role, roleFilter));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Get total count
  const totalResult = await db
    .select({ count: count() })
    .from(users)
    .where(whereClause);

  const total = totalResult[0]?.count || 0;

  // Apply pagination
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

  // Get application counts for each user
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
