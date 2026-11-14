import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { visaApplications, passportServices } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { Button } from '@/components/ui';
import { ApplicationStatusCell } from '@/components/shared/ApplicationStatusCell';
import { FlagLogo } from '@/components/shared/FlagLogo';
import { DraftApplicationsList } from '@/components/dashboard/DraftApplicationsList';
import { loadTravellerSummaries } from '@/lib/visa/travellerStatus';
import { listMyApplicationDrafts } from '@/lib/apply/serverDraft';
import { listMyPassportDrafts } from '@/lib/apply/passportDraftActions';
import { flagUrlFor, getCountryFlagMap } from '@/lib/countries/flags';
import { loadVisaOutcomePresence } from '@/lib/visa/outcomeDocument';
import Link from 'next/link';

export default async function ApplicationsPage() {
  const session = await auth();
  if (!session) redirect('/signin');

  const [visaAppsAll, passportAppsAll, draftsResult, passportDraftsResult] =
    await Promise.all([
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
      listMyApplicationDrafts(),
      listMyPassportDrafts(),
    ]);

  const visaApps = visaAppsAll.filter((a) => a.status !== 'draft');
  const passportApps = passportAppsAll.filter((a) => a.status !== 'draft');

  const visaDrafts = draftsResult.success ? draftsResult.drafts : [];
  const passportDrafts = passportDraftsResult.success
    ? passportDraftsResult.drafts.map((d) => ({
        id: d.id,
        listingId: d.listingId,
        listingSlug: d.listingSlug ?? null,
        countryCode: 'IN',
        referenceNumber: d.referenceNumber,
        updatedAt: d.updatedAt,
        kind: 'passport' as const,
        passportServiceType: d.serviceType,
        payload: {
          version: 1,
          updatedAt: d.updatedAt,
          countryCode: 'IN',
          countryName: 'India',
          listingId: d.listingId,
          processName: d.serviceType,
          step: 'form',
          primaryName: '',
          travellers: [],
          departure: {},
          travellersCount: 1,
        },
      }))
    : [];
  const drafts = [...visaDrafts, ...passportDrafts].sort(
    (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
  );

  const [summaries, flagUrls, outcomePresence] = await Promise.all([
    loadTravellerSummaries(visaApps.map((app) => app.id)),
    getCountryFlagMap([
      ...drafts.map((d) => d.countryCode || d.payload.countryCode),
      ...visaApps.map((app) => app.countryCode),
    ]),
    loadVisaOutcomePresence(visaApps.map((app) => app.id)),
  ]);

  const rows = [
    ...visaApps.map((app) => {
      const summary = summaries.get(app.id);
      return {
        id: app.id,
        title: `${app.country || app.countryCode || 'Visa'} · ${app.visaType}`,
        countryCode: app.countryCode,
        status: app.status,
        travellerCount: summary?.travellerCount ?? 0,
        approvedTravellerCount: summary?.approvedCount ?? 0,
        date: app.submittedAt || app.createdAt,
        kind: 'visa' as const,
        href: `/applications/visa/${app.referenceNumber || app.id}`,
        hasVisaDocument: outcomePresence.has(app.id),
      };
    }),
    ...passportApps.map((app) => ({
      id: app.id,
      title: `Passport · ${app.serviceType}`,
      countryCode: null as string | null,
      status: app.status,
      travellerCount: 0,
      approvedTravellerCount: 0,
      date: app.submittedAt || app.createdAt,
      kind: 'passport' as const,
      href: `/applications/passport/${app.referenceNumber || app.id}`,
      hasVisaDocument: false,
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
        <Link href="/">
          <Button variant="primary" size="md">
            New application
          </Button>
        </Link>
      </div>

      <DraftApplicationsList drafts={drafts} flagUrls={flagUrls} />

      {rows.length === 0 ? (
        <div className="rounded-[24px] border border-ash bg-white px-6 py-14 text-center">
          <p className="font-switzer text-portrait-ink">
            {drafts.length > 0
              ? 'No submitted applications yet'
              : 'No applications yet'}
          </p>
          <p className="mt-2 font-switzer text-sm text-slate-helper">
            {drafts.length > 0
              ? 'Continue a draft above, or browse destinations for a new visa.'
              : 'Browse destinations to start your first visa.'}
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
                <div className="flex min-w-0 items-start gap-3">
                  {row.kind === 'visa' ? (
                    <FlagLogo
                      countryCode={row.countryCode}
                      flagUrl={flagUrlFor(flagUrls, row.countryCode)}
                      alt={row.title}
                      size="md"
                      className="mt-0.5"
                    />
                  ) : null}
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
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <ApplicationStatusCell
                    status={row.status}
                    travellerCount={row.travellerCount}
                    approvedTravellerCount={row.approvedTravellerCount}
                    readable
                  />
                  {row.hasVisaDocument ? (
                    <span className="font-switzer text-xs text-nautical-teal">
                      Document ready
                    </span>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
