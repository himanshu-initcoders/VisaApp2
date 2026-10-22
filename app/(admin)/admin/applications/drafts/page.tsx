import Link from 'next/link';
import { requireRole } from '@/lib/auth-utils';
import { PageHeader } from '@/components/admin/PageHeader';
import { DiscardDraftButton } from '@/components/apply/DiscardDraftButton';
import { FlagLogo } from '@/components/shared/FlagLogo';
import { formatDraftUpdatedAt } from '@/lib/apply/draftStorage';
import { listAdminApplicationDrafts } from '@/lib/apply/serverDraft';
import { flagUrlFor, getCountryFlagMap } from '@/lib/countries/flags';

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function AdminApplyDraftsPage({ searchParams }: PageProps) {
  await requireRole(['admin', 'reviewer']);
  const params = await searchParams;
  const result = await listAdminApplicationDrafts({
    search: params.q,
    limit: 100,
  });
  const drafts = result.success ? result.drafts : [];
  const flagUrls = await getCountryFlagMap(
    drafts.map((d) => d.countryCode || d.payload.countryCode)
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Apply drafts"
        description="In-progress visa applications saved before submit (not submitted cases)."
        action={
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/admin/applications"
              className="font-switzer text-sm text-nautical-teal hover:text-portrait-ink"
            >
              Submitted applications
            </Link>
            <Link
              href="/admin/applications/drafts/new"
              className="inline-flex items-center rounded-button border-[1.5px] border-portrait-ink px-4 py-2.5 font-switzer text-base font-medium text-portrait-ink hover:bg-portrait-ink hover:text-white"
            >
              Start draft
            </Link>
          </div>
        }
      />

      <form className="flex flex-wrap gap-3">
        <input
          type="search"
          name="q"
          defaultValue={params.q || ''}
          placeholder="Search name, phone, country, process…"
          className="min-w-[240px] flex-1 rounded-2xl border border-ash bg-white px-4 py-2.5 font-switzer text-sm text-portrait-ink"
        />
        <button
          type="submit"
          className="inline-flex items-center rounded-full border border-portrait-ink px-4 py-2 text-sm font-medium text-portrait-ink hover:bg-portrait-ink hover:text-white"
        >
          Search
        </button>
      </form>

      {!result.success && (
        <p className="font-switzer text-sm text-red-600">{result.error}</p>
      )}

      {drafts.length === 0 ? (
        <div className="rounded-[24px] border border-ash bg-white px-6 py-14 text-center">
          <p className="font-switzer text-portrait-ink">No apply drafts yet</p>
          <p className="mt-2 font-switzer text-sm text-slate-helper">
            Start a draft for an applicant, or wait until someone uses Save as
            draft.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[24px] border border-ash bg-white">
          <table className="w-full text-left">
            <thead className="border-b border-mist bg-sky-wash/30">
              <tr className="font-switzer text-xs uppercase tracking-wide text-slate-helper">
                <th className="px-4 py-3 font-medium">Applicant</th>
                <th className="px-4 py-3 font-medium">Process</th>
                <th className="px-4 py-3 font-medium">Updated</th>
                <th className="px-4 py-3 font-medium">Saved by</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {drafts.map((draft) => {
                const cc = (
                  draft.countryCode ||
                  draft.payload.countryCode ||
                  'xx'
                ).toLowerCase();
                const ownerIsStaff =
                  draft.user.role === 'admin' || draft.user.role === 'reviewer';
                // Own staff drafts: resume without onBehalfOf. Applicant drafts: on behalf.
                const continueHref = ownerIsStaff
                  ? `/visa/${cc}/${draft.listingId}/apply?resume=1`
                  : `/visa/${cc}/${draft.listingId}/apply?onBehalfOf=${encodeURIComponent(draft.user.id)}&resume=1`;
                const processLabel =
                  draft.payload.processName ||
                  draft.payload.countryName ||
                  'Visa';
                const country =
                  draft.payload.countryName ||
                  draft.countryCode ||
                  draft.payload.countryCode ||
                  '';

                return (
                  <tr
                    key={draft.id}
                    className="border-b border-mist last:border-0"
                  >
                    <td className="px-4 py-3 align-top">
                      <p className="font-switzer text-sm font-medium text-portrait-ink">
                        {draft.user.name}
                        {ownerIsStaff ? (
                          <span className="ml-1 font-normal text-slate-helper">
                            (staff)
                          </span>
                        ) : null}
                      </p>
                      <p className="font-switzer text-xs text-slate-helper">
                        {draft.user.phone
                          ? `+91 ${draft.user.phone}`
                          : draft.user.email}
                      </p>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-start gap-2.5">
                        <FlagLogo
                          countryCode={cc}
                          flagUrl={flagUrlFor(flagUrls, cc)}
                          alt={country || cc}
                          size="sm"
                          shape="rect"
                          className="mt-0.5"
                        />
                        <div>
                          <p className="font-switzer text-sm text-portrait-ink">
                            {country
                              ? `${country} · ${processLabel}`
                              : processLabel}
                          </p>
                          <p className="font-switzer text-xs text-slate-helper">
                            Step: {draft.payload.step || 'travellers'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top font-switzer text-sm text-slate-helper">
                      {formatDraftUpdatedAt(draft.updatedAt)}
                    </td>
                    <td className="px-4 py-3 align-top font-switzer text-sm text-slate-helper">
                      {draft.savedBy
                        ? `${draft.savedBy.name}${
                            draft.savedBy.role === 'admin' ||
                            draft.savedBy.role === 'reviewer'
                              ? ' (staff)'
                              : ''
                          }`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-wrap items-center gap-3">
                        <Link
                          href={continueHref}
                          className="font-switzer text-sm font-medium text-nautical-teal hover:text-portrait-ink"
                        >
                          Continue
                        </Link>
                        <DiscardDraftButton
                          mode="admin"
                          draftId={draft.id}
                          listingId={draft.listingId}
                          ownerUserId={draft.user.id}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
