import Link from 'next/link';
import { ApplicationStatusCell } from '@/components/shared/ApplicationStatusCell';
import { FlagLogo } from '@/components/shared/FlagLogo';
import { flagUrlFor } from '@/lib/countries/flags';

export function UserApplicationListItem({
  href,
  title,
  reference,
  dateLabel,
  status,
  travellerCount = 0,
  approvedTravellerCount = 0,
  countryCode,
  flagUrls,
  showFlag = true,
  documentReady = false,
  isLast = false,
}: {
  href: string;
  title: string;
  reference: string;
  dateLabel: string;
  status: string;
  travellerCount?: number;
  approvedTravellerCount?: number;
  countryCode?: string | null;
  flagUrls?: Record<string, string | null>;
  showFlag?: boolean;
  documentReady?: boolean;
  isLast?: boolean;
}) {
  return (
    <li>
      <Link
        href={href}
        className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-sky-wash/25 sm:grid-cols-[minmax(0,1.4fr)_minmax(8rem,0.9fr)_6.5rem_auto] sm:gap-x-5 ${
          isLast ? '' : 'border-b border-ash'
        }`}
      >
        <div className="flex min-w-0 items-center gap-3">
          {showFlag ? (
            <FlagLogo
              countryCode={countryCode}
              flagUrl={flagUrlFor(flagUrls, countryCode)}
              alt={title}
              size="md"
              className="shrink-0"
            />
          ) : (
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-wash/60 font-switzer text-[10px] font-semibold text-nautical-teal"
              aria-hidden
            >
              PP
            </span>
          )}
          <p className="truncate font-switzer text-sm font-medium text-portrait-ink">
            {title}
          </p>
        </div>

        <p className="col-start-1 row-start-2 truncate pl-9 font-mono font-switzer text-xs text-nautical-teal sm:col-start-auto sm:row-start-auto sm:pl-0">
          {reference}
        </p>

        <p className="hidden font-switzer text-xs text-slate-helper sm:block">
          {dateLabel}
        </p>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <ApplicationStatusCell
            status={status}
            travellerCount={travellerCount}
            approvedTravellerCount={approvedTravellerCount}
            readable
          />
          <p className="font-switzer text-[11px] text-slate-helper sm:hidden">
            {dateLabel}
          </p>
          {documentReady ? (
            <span className="font-switzer text-[11px] text-nautical-teal">
              Document ready
            </span>
          ) : null}
        </div>
      </Link>
    </li>
  );
}
