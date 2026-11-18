import Link from 'next/link';
import { getApplicationsWithFilters } from '@/lib/admin-queries';
import { getCountryFlagMap } from '@/lib/countries/flags';
import { loadVisaOutcomePresence } from '@/lib/visa/outcomeDocument';
import { listMyApplicationDrafts } from '@/lib/apply/serverDraft';
import { listMyPassportDrafts } from '@/lib/apply/passportDraftActions';
import { Button } from '@/components/ui';
import { DraftApplicationsList } from '@/components/dashboard/DraftApplicationsList';
import { UserApplicationListItem } from '@/components/dashboard/UserApplicationListItem';
import { UserApplicationsFilterBar } from '@/components/dashboard/UserApplicationsFilterBar';
import { UserApplicationsPagination } from '@/components/dashboard/UserApplicationsPagination';
import type { ApplicationFilters } from '@/types/admin';

export type UserApplicationsScope = 'visa' | 'passport';

type SearchParams = {
  ref?: string;
  page?: string;
  limit?: string;
};

function formatAppDate(date: Date | string) {
  return new Date(date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
}

export async function UserApplicationsList({
  scope,
  userId,
  searchParams,
}: {
  scope: UserApplicationsScope;
  userId: string;
  searchParams: SearchParams;
}) {
  const isVisa = scope === 'visa';
  const page = Math.max(1, parseInt(searchParams.page || '1', 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.limit || '10', 10) || 10)
  );

  const filters: ApplicationFilters = {
    userId,
    type: scope,
    referenceNumber: searchParams.ref,
    excludeDraft: true,
    page,
    limit,
    sortBy: 'submittedAt',
    sortOrder: 'desc',
  };

  const [result, draftsResult, passportDraftsResult] = await Promise.all([
    getApplicationsWithFilters(filters),
    isVisa ? listMyApplicationDrafts() : Promise.resolve(null),
    !isVisa ? listMyPassportDrafts() : Promise.resolve(null),
  ]);

  const drafts = isVisa
    ? draftsResult && draftsResult.success
      ? draftsResult.drafts
      : []
    : passportDraftsResult && passportDraftsResult.success
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

  const [flagUrls, outcomePresence] = await Promise.all([
    getCountryFlagMap([
      ...drafts.map((d) => d.countryCode || d.payload.countryCode),
      ...result.applications.map((app) => app.countryCode),
    ]),
    isVisa
      ? loadVisaOutcomePresence(result.applications.map((app) => app.id))
      : Promise.resolve(new Set<string>()),
  ]);

  const title = isVisa ? 'Visa applications' : 'Passport applications';
  const description = isVisa
    ? 'Track and continue your visa applications'
    : 'Track and continue your passport applications';
  const emptySubmitted =
    drafts.length > 0
      ? `No submitted ${scope} applications yet`
      : `No ${scope} applications yet`;
  const emptyHint =
    drafts.length > 0
      ? 'Continue a draft above, or start a new application.'
      : isVisa
        ? 'Browse destinations to start your first visa.'
        : 'Start a passport service to see it here.';

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-basier text-[36px] leading-tight text-portrait-ink sm:text-[40px]">
            {title}
          </h1>
          <p className="mt-1.5 font-switzer text-sm text-slate-helper sm:text-base">
            {description}
          </p>
        </div>
        <Link href="/">
          <Button variant="primary" size="md">
            New application
          </Button>
        </Link>
      </div>

      <DraftApplicationsList
        drafts={drafts}
        title={isVisa ? 'Visa drafts' : 'Passport drafts'}
        description={
          isVisa
            ? 'Continue a visa application you saved for later.'
            : 'Continue a passport application you saved for later.'
        }
        flagUrls={flagUrls}
      />

      <section className="space-y-3">
        <UserApplicationsFilterBar scope={scope} />

        {result.applications.length === 0 ? (
          <div className="rounded-[24px] border border-ash bg-white px-6 py-12 text-center">
            <p className="font-switzer text-portrait-ink">{emptySubmitted}</p>
            <p className="mt-2 font-switzer text-sm text-slate-helper">
              {emptyHint}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[24px] border border-ash bg-white">
            <div className="hidden border-b border-ash bg-[#fafbfc] px-4 py-2.5 sm:grid sm:grid-cols-[minmax(0,1.4fr)_minmax(8rem,0.9fr)_6.5rem_auto] sm:gap-x-5">
              <p className="font-switzer text-[11px] font-semibold uppercase tracking-wider text-slate-helper">
                Application
              </p>
              <p className="font-switzer text-[11px] font-semibold uppercase tracking-wider text-slate-helper">
                Reference
              </p>
              <p className="font-switzer text-[11px] font-semibold uppercase tracking-wider text-slate-helper">
                Submitted
              </p>
              <p className="text-right font-switzer text-[11px] font-semibold uppercase tracking-wider text-slate-helper">
                Status
              </p>
            </div>
            <ul>
              {result.applications.map((app, index) => {
                const reference = app.referenceNumber || app.id.slice(0, 8);
                const href = `/applications/${scope}/${app.referenceNumber || app.id}`;
                const titleLine = isVisa
                  ? `${app.country || app.countryCode || 'Visa'} · ${app.visaType || 'Visa'}`
                  : `${app.serviceType || 'Passport service'}`;
                const date = app.submittedAt || app.createdAt;

                return (
                  <UserApplicationListItem
                    key={`${app.type}-${app.id}`}
                    href={href}
                    title={titleLine}
                    reference={reference}
                    dateLabel={formatAppDate(date)}
                    status={app.status}
                    travellerCount={app.travellerCount}
                    approvedTravellerCount={app.approvedTravellerCount}
                    countryCode={app.countryCode}
                    flagUrls={flagUrls}
                    showFlag={isVisa}
                    documentReady={isVisa && outcomePresence.has(app.id)}
                    isLast={index === result.applications.length - 1}
                  />
                );
              })}
            </ul>
          </div>
        )}

        {result.total > 0 ? (
          <UserApplicationsPagination
            currentPage={result.page}
            totalPages={Math.max(result.totalPages, 1)}
            itemsPerPage={result.limit}
            totalItems={result.total}
          />
        ) : null}
      </section>
    </div>
  );
}
