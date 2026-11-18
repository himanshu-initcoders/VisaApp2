import Link from 'next/link';
import { ArrowUpRight, Clock3, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui';
import { MediaImage } from '@/components/shared/MediaImage';
import { cn } from '@/lib/utils';
import { formatProcessType, getCountryCardImage, getFlagEmoji } from '@/lib/public';

interface PublicProcessCardProps {
  process: {
    id: string;
    href: string;
    processName: string;
    processType: string;
    processTypeLabel?: string | null;
    formattedStartingPrice: string;
    standardEta?: string | null;
    startingPrice: number;
    /** Government fee is ₹0 — visa DIY/free; service fee may still apply. */
    isFree?: boolean;
    withFreeInsurance?: boolean;
    country: {
      name: string;
      iso2Code: string;
      images?: {
        banner?: {
          url?: string;
          alt?: string;
        };
        hero?: {
          url?: string;
          alt?: string;
        };
      } | null;
    };
  };
  className?: string;
}

export function PublicProcessCard({
  process,
  className,
}: PublicProcessCardProps) {
  const isFree = process.isFree ?? process.startingPrice === 0;
  const withFreeInsurance = Boolean(process.withFreeInsurance);
  const cardImage = getCountryCardImage(process.country.images);

  return (
    <Link
      href={process.href}
      className={cn(
        'group flex overflow-hidden rounded-2xl border border-ash-divider bg-white/95 shadow-card transition-all duration-300 sm:block sm:rounded-[28px] sm:hover:-translate-y-1 sm:hover:shadow-elevated',
        className
      )}
    >
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl m-3 sm:m-0 sm:h-72 sm:w-full sm:rounded-none">
        {cardImage ? (
          <MediaImage
            src={cardImage.url}
            alt={cardImage.alt || process.country.name}
            fill
            sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 80px"
            className="object-cover transition-transform duration-500 sm:group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-sky-wash text-3xl sm:text-7xl">
            {getFlagEmoji(process.country.iso2Code)}
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 hidden bg-gradient-to-t from-[#0b1220] via-[#0b1220]/25 to-transparent sm:block" />

        <div className="absolute left-1 top-1 flex flex-col gap-0.5 sm:left-4 sm:top-4 sm:flex-row sm:flex-wrap sm:gap-2">
          <Badge className="hidden border-0 bg-white/85 text-portrait-ink backdrop-blur sm:inline-flex">
            {process.processTypeLabel || formatProcessType(process.processType)}
          </Badge>
          {isFree && (
            <div className="rounded-md bg-mint-wash px-1.5 py-0.5 text-[10px] font-medium text-portrait-ink sm:rounded-full sm:border-0 sm:px-2.5 sm:py-0.5 sm:text-xs">
              Free
            </div>
          )}
          {withFreeInsurance && (
            <div className="rounded-md bg-mint-wash px-1.5 py-0.5 text-[10px] font-medium text-portrait-ink sm:rounded-full sm:border-0 sm:px-2.5 sm:py-0.5 sm:text-xs">
              Free Insurance
            </div>
          )}
        </div>

        <div
          className="absolute bottom-4 left-4 right-4 hidden items-end justify-between gap-4 sm:flex"
          aria-hidden="true"
        >
          <div>
            <p className="mb-2 flex items-center gap-2 text-sm text-white/80">
              <span>{getFlagEmoji(process.country.iso2Code)}</span>
              <span>{process.country.name}</span>
            </p>
            <p className="max-w-[14rem] text-xl font-medium leading-tight text-white">
              {process.processName}
            </p>
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-portrait-ink transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1">
            <ArrowUpRight className="h-5 w-5" />
          </span>
        </div>
      </div>

      <div className="min-w-0 flex-1 p-3 sm:space-y-4 sm:p-5">
        <div>
          <p className="flex items-center gap-1.5 text-xs text-slate-helper sm:hidden">
            <span>{getFlagEmoji(process.country.iso2Code)}</span>
            {process.country.name}
          </p>
          <h3 className="mt-0.5 truncate text-[15px] font-medium text-portrait-ink sm:sr-only">
            {process.processName}
          </h3>
          <div className="mt-1.5 flex items-center gap-3 sm:hidden">
            <span className="text-sm font-semibold text-portrait-ink">
              {process.formattedStartingPrice}
            </span>
            {process.standardEta && (
              <span className="flex items-center gap-1 text-xs text-slate-helper">
                <Clock3 className="h-3 w-3" />
                {process.standardEta}
              </span>
            )}
          </div>
        </div>

        <div className="hidden items-center justify-between gap-4 sm:flex">
          <div className="flex items-center gap-2 text-sm text-slate-helper">
            <Clock3 className="h-4 w-4" />
            <span>{process.standardEta || 'Timeline shared instantly'}</span>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-helper">
              Starting from
            </p>
            <p className="text-lg font-semibold text-portrait-ink">
              {process.formattedStartingPrice}
            </p>
          </div>
        </div>

        <div className="hidden items-center justify-between rounded-[20px] bg-[#f5f7fb] px-4 py-3 text-sm text-slate-helper sm:flex">
          <span className="inline-flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-nautical-teal" />
            Reviewed for Indian travelers
          </span>
          <span className="font-medium text-portrait-ink">Explore</span>
        </div>
      </div>

      <ArrowUpRight className="m-3 h-5 w-5 shrink-0 self-center text-slate-helper sm:hidden" />
    </Link>
  );
}
