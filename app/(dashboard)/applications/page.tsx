import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { visaApplications, passportServices } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { Button } from '@/components/ui';
import { ApplicationStatusCell } from '@/components/shared/ApplicationStatusCell';
import { loadTravellerSummaries } from '@/lib/visa/travellerStatus';
import Link from 'next/link';

export default async function ApplicationsPage() {
  const session = await auth();
  if (!session) redirect('/signin');

  const [visaApps, passportApps] = await Promise.all([
    db
      .select()
      .from(visaApplications)
      .where(eq(visaApplications.userId, session.user.id))
      .orderBy(desc(visaApplications.createdAt)),
    db
      .select()
      .from(passportServices)
      .where(eq(passportServices.userId, session.user.id))
      .orderBy(desc(passportServices.createdAt)),
  ]);

  const summaries = await loadTravellerSummaries(visaApps.map((app) => app.id));

  const rows = [
    ...visaApps.map((app) => {
      const summary = summaries.get(app.id);
      return {
        id: app.id,
        title: `${app.country || app.countryCode || 'Visa'} · ${app.visaType}`,
        status: app.status,
        travellerCount: summary?.travellerCount ?? 0,
        approvedTravellerCount: summary?.approvedCount ?? 0,
        date: app.submittedAt || app.createdAt,
        kind: 'visa' as const,
        href: `/applications/visa/${app.id}`,
      };
    }),
    ...passportApps.map((app) => ({
      id: app.id,
      title: `Passport · ${app.serviceType}`,
      status: app.status,
      travellerCount: 0,
      approvedTravellerCount: 0,
      date: app.submittedAt || app.createdAt,
      kind: 'passport' as const,
      href: `/applications/passport/${app.id}`,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-basier text-[40px] leading-tight text-portrait-ink">
            Applications
          </h1>
          <p className="mt-2 font-switzer text-slate-helper">
            All of your visa and passport applications
          </p>
        </div>
        <Link href="/destinations">
          <Button variant="primary" size="md">
            New application
          </Button>
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-[24px] border border-ash bg-white px-6 py-14 text-center">
          <p className="font-switzer text-portrait-ink">No applications yet</p>
          <p className="mt-2 font-switzer text-sm text-slate-helper">
            Browse destinations to start your first visa.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={`${row.kind}-${row.id}`}>
              <Link
                href={row.href}
                className="flex items-center justify-between gap-4 rounded-[20px] border border-ash bg-white px-5 py-4 transition-colors hover:border-nautical-teal/40 hover:bg-sky-wash/20"
              >
                <div className="min-w-0">
                  <p className="font-switzer text-xs uppercase tracking-wide text-slate-helper">
                    {row.kind === 'visa' ? 'Visa' : 'Passport'}
                  </p>
                  <p className="mt-1 truncate font-switzer text-sm font-medium text-portrait-ink">
                    {row.title}
                  </p>
                  <p className="mt-1 font-switzer text-xs text-slate-helper">
                    {new Date(row.date).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      timeZone: 'Asia/Kolkata',
                    })}
                  </p>
                </div>
                <ApplicationStatusCell
                  status={row.status}
                  travellerCount={row.travellerCount}
                  approvedTravellerCount={row.approvedTravellerCount}
                  readable
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
