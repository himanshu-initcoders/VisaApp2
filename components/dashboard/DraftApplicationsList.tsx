import Link from 'next/link';
import { DiscardDraftButton } from '@/components/apply/DiscardDraftButton';
import { FlagLogo } from '@/components/shared/FlagLogo';
import { formatDraftUpdatedAt } from '@/lib/apply/draftStorage';
import type { ServerDraftPayload } from '@/lib/apply/serverDraft';
import { flagUrlFor } from '@/lib/countries/flags';

export interface DraftApplicationRow {
  id: string;
  listingId: string;
  countryCode: string | null;
  updatedAt: string;
  payload: ServerDraftPayload;
}

interface DraftApplicationsListProps {
  drafts: DraftApplicationRow[];
  title?: string;
  description?: string;
  /** ISO2 → flag image URL from countries.images.flag.url */
  flagUrls?: Record<string, string | null>;
}

function continueHref(draft: DraftApplicationRow) {
  const cc = (draft.countryCode || draft.payload.countryCode || 'xx').toLowerCase();
  return `/visa/${cc}/${draft.listingId}/apply?resume=1`;
}

function draftCountryCode(draft: DraftApplicationRow): string {
  return (draft.countryCode || draft.payload.countryCode || '').toUpperCase();
}

export function DraftApplicationsList({
  drafts,
  title = 'Saved drafts',
  description = 'Continue an application you saved for later.',
  flagUrls,
}: DraftApplicationsListProps) {
  if (drafts.length === 0) return null;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-basier text-2xl text-portrait-ink">{title}</h2>
        <p className="mt-1 font-switzer text-sm text-slate-helper">
          {description}
        </p>
      </div>
      <ul className="space-y-3">
        {drafts.map((draft) => {
          const processName =
            draft.payload.processName ||
            draft.payload.countryName ||
            'Visa application';
          const country =
            draft.payload.countryName ||
            draft.countryCode ||
            draft.payload.countryCode ||
            '';
          const travellers =
            draft.payload.travellersCount ||
            (Array.isArray(draft.payload.travellers)
              ? draft.payload.travellers.length
              : 1);
          const code = draftCountryCode(draft);

          return (
            <li
              key={draft.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-[20px] border border-ash bg-white px-5 py-4"
            >
              <div className="flex min-w-0 items-start gap-3">
                <FlagLogo
                  countryCode={code}
                  flagUrl={flagUrlFor(flagUrls, code)}
                  alt={country || code}
                  size="md"
                  className="mt-0.5"
                />
                <div className="min-w-0">
                  <p className="font-switzer text-xs uppercase tracking-wide text-slate-helper">
                    Draft · Visa
                  </p>
                  <p className="mt-1 truncate font-switzer text-sm font-medium text-portrait-ink">
                    {country ? `${country} · ${processName}` : processName}
                  </p>
                  <p className="mt-1 font-switzer text-xs text-slate-helper">
                    {travellers} traveller{travellers === 1 ? '' : 's'}
                    {draft.updatedAt
                      ? ` · Saved ${formatDraftUpdatedAt(draft.updatedAt)}`
                      : ''}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-3">
                <DiscardDraftButton listingId={draft.listingId} />
                <Link
                  href={continueHref(draft)}
                  className="inline-flex items-center rounded-button border-[1.5px] border-portrait-ink px-4 py-2 font-switzer text-sm font-medium text-portrait-ink hover:bg-portrait-ink hover:text-white"
                >
                  Continue
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
