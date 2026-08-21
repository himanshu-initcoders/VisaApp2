import { StatsCard } from '@/components/admin/StatsCard';
import { Card, CardHeader, CardTitle, CardContent, Badge } from '@/components/ui';
import { getStatusVariant } from '@/components/ui/Badge';
import { db } from '@/lib/db';
import { visaApplications, passportServices, documents } from '@/lib/db/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import Link from 'next/link';

/**
 * Admin Dashboard
 *
 * Overview page with key metrics and recent applications
 */

export default async function AdminDashboardPage() {
  // Parallel data fetching for performance
  const [
    totalVisaApps,
    totalPassportApps,
    pendingReviews,
    unverifiedDocs,
    recentApplications,
  ] = await Promise.all([
    // Total visa applications
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(visaApplications)
      .then((res) => res[0]?.count || 0),

    // Total passport applications
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(passportServices)
      .then((res) => res[0]?.count || 0),

    // Pending reviews (under_review status)
    Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(visaApplications)
        .where(eq(visaApplications.status, 'under_review'))
        .then((res) => res[0]?.count || 0),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(passportServices)
        .where(eq(passportServices.status, 'under_review'))
        .then((res) => res[0]?.count || 0),
    ]).then(([visa, passport]) => visa + passport),

    // Unverified documents
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(documents)
      .where(eq(documents.verified, false))
      .then((res) => res[0]?.count || 0),

    // Recent applications (last 10, both visa and passport)
    Promise.all([
      db
        .select({
          id: visaApplications.id,
          country: visaApplications.country,
          visaType: visaApplications.visaType,
          status: visaApplications.status,
          submittedAt: visaApplications.submittedAt,
          type: sql<string>`'visa'`,
        })
        .from(visaApplications)
        .orderBy(desc(visaApplications.submittedAt))
        .limit(5),
      db
        .select({
          id: passportServices.id,
          serviceType: passportServices.serviceType,
          status: passportServices.status,
          submittedAt: passportServices.submittedAt,
          type: sql<string>`'passport'`,
        })
        .from(passportServices)
        .orderBy(desc(passportServices.submittedAt))
        .limit(5),
    ]).then(([visa, passport]) => {
      // Combine and sort by submittedAt
      const combined = [
        ...visa.map((v) => ({
          id: v.id,
          displayName: `${v.country} - ${v.visaType}`,
          status: v.status,
          submittedAt: v.submittedAt,
          type: 'visa' as const,
        })),
        ...passport.map((p) => ({
          id: p.id,
          displayName: p.serviceType || 'Passport Service',
          status: p.status,
          submittedAt: p.submittedAt,
          type: 'passport' as const,
        })),
      ];
      return combined
        .sort((a, b) => {
          const dateA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
          const dateB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
          return dateB - dateA;
        })
        .slice(0, 10);
    }),
  ]);

  const totalApplications = totalVisaApps + totalPassportApps;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="font-basier text-[44px] text-portrait-ink leading-tight tracking-tight">
          Dashboard
        </h1>
        <p className="font-switzer text-lg text-slate-helper mt-2">
          Overview of visa applications and passport services
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Applications"
          value={totalApplications}
          icon={
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          }
        />
        <Link href="/admin/applications?status=under_review">
          <StatsCard
            title="Pending Reviews"
            value={pendingReviews}
            icon={
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            }
            className="hover:border-sky-wash cursor-pointer"
          />
        </Link>
        <StatsCard
          title="Visa Applications"
          value={totalVisaApps}
          icon={
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
        />
        <StatsCard
          title="Unverified Documents"
          value={unverifiedDocs}
          icon={
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          }
        />
      </div>

      {/* Recent Applications */}
      <Card>
        <CardHeader>
          <CardTitle className="font-basier text-[31px] text-portrait-ink">
            Recent Applications
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentApplications.length === 0 ? (
              <p className="font-switzer text-slate-helper text-center py-8">
                No applications yet
              </p>
            ) : (
              recentApplications.map((app) => (
                <Link
                  key={`${app.type}-${app.id}`}
                  href={`/admin/applications/${app.type}/${app.id}`}
                  className="flex items-center justify-between p-4 rounded-lg border border-ash hover:bg-sky-wash/20 transition-colors"
                >
                  <div className="space-y-1">
                    <p className="font-switzer text-sm font-medium text-portrait-ink">
                      {app.displayName}
                    </p>
                    <p className="font-switzer text-xs text-slate-helper">
                      {app.submittedAt
                        ? new Date(app.submittedAt).toLocaleDateString('en-IN', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })
                        : 'Not submitted'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={getStatusVariant(app.status)}>
                      {app.status}
                    </Badge>
                    <span className="font-switzer text-xs text-slate-helper uppercase">
                      {app.type}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link href="/admin/applications?status=under_review">
          <Card className="hover:shadow-elevated transition-shadow cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-switzer text-lg font-semibold text-portrait-ink">
                    Review Applications
                  </h3>
                  <p className="font-switzer text-sm text-slate-helper mt-1">
                    {pendingReviews} applications waiting for review
                  </p>
                </div>
                <svg
                  className="w-8 h-8 text-nautical-teal"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/applications">
          <Card className="hover:shadow-elevated transition-shadow cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-switzer text-lg font-semibold text-portrait-ink">
                    All Applications
                  </h3>
                  <p className="font-switzer text-sm text-slate-helper mt-1">
                    View and manage all submitted applications
                  </p>
                </div>
                <svg
                  className="w-8 h-8 text-nautical-teal"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
