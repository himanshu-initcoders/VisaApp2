import Link from 'next/link';
import { DiscardDraftButton } from '@/components/apply/DiscardDraftButton';
import { FlagLogo } from '@/components/shared/FlagLogo';
import { formatDraftUpdatedAt } from '@/lib/apply/draftStorage';
import type { ServerDraftPayload } from '@/lib/apply/serverDraft';
import { flagUrlFor } from '@/lib/countries/flags';

export interface DraftApplicationRow {
  id: string;
  listingId: string;
  listingSlug?: string | null;
  countryCode: string | null;
  referenceNumber?: string;
  updatedAt: string;
  payload: ServerDraftPayload;
  kind?: 'visa' | 'passport';
  /** Passport-only display fields when payload is synthetic. */
  passportServiceType?: string;
}

interface DraftApplicationsListProps {
  drafts: DraftApplicationRow[];
  title?: string;
  description?: string;
  /** ISO2 → flag image URL from countries.images.flag.url */
  flagUrls?: Record<string, string | null>;
}

function continueHref(draft: DraftApplicationRow) {
  if (draft.kind === 'passport') {
    const service =
      draft.passportServiceType ||
      draft.payload.processName ||
      'fresh';
    return `/passport/${service}/apply?resume=1`;
  }
  const cc = (draft.countryCode || draft.payload.countryCode || 'xx').toLowerCase();
  const segment = draft.listingSlug || draft.listingId;
  return `/visa/${cc}/${segment}/apply?resume=1`;
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
      <div className="overflow-hidden rounded-[24px] border border-ash bg-white">
        <ul>
          {drafts.map((draft, index) => {
            const isPassport = draft.kind === 'passport';
            const processName =
              draft.payload.processName ||
              draft.payload.countryName ||
              (isPassport ? 'Passport application' : 'Visa application');
            const country =
              draft.payload.countryName ||
              draft.countryCode ||
              draft.payload.countryCode ||
              (isPassport ? 'India' : '');
            const travellers =
              draft.payload.travellersCount ||
              (Array.isArray(draft.payload.travellers)
                ? draft.payload.travellers.length
                : 1);
            const code = isPassport ? 'IN' : draftCountryCode(draft);
            const titleLine = country
              ? `${country} · ${processName}`
              : processName;
            const meta = [
              draft.referenceNumber,
              isPassport
                ? null
                : `${travellers} traveller${travellers === 1 ? '' : 's'}`,
              draft.updatedAt
                ? `Saved ${formatDraftUpdatedAt(draft.updatedAt)}`
                : null,
            ]
              .filter(Boolean)
              .join(' · ');
            const isLast = index === drafts.length - 1;

            return (
              <li
                key={draft.id}
                className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 ${
                  isLast ? '' : 'border-b border-ash'
                }`}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <FlagLogo
                    countryCode={code}
                    flagUrl={flagUrlFor(flagUrls, code)}
                    alt={country || code}
                    size="md"
                    className="shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="truncate font-switzer text-sm font-medium text-portrait-ink">
                      {titleLine}
                    </p>
                    {meta ? (
                      <p className="mt-0.5 truncate font-switzer text-xs text-slate-helper">
                        {meta}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <DiscardDraftButton listingId={draft.listingId} />
                  <Link
                    href={continueHref(draft)}
                    className="inline-flex items-center rounded-button border-[1.5px] border-portrait-ink px-3.5 py-1.5 font-switzer text-sm font-medium text-portrait-ink hover:bg-portrait-ink hover:text-white"
                  >
                    Continue
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
