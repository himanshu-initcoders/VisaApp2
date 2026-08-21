import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, Clock3, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui';
import { cn } from '@/lib/utils';
import { formatProcessType, getFlagEmoji } from '@/lib/public';

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
    country: {
      name: string;
      iso2Code: string;
      images?: {
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
  const isFree = process.startingPrice === 0;

  return (
    <Link
      href={process.href}
      className={cn(
        'group block overflow-hidden rounded-2xl border border-ash-divider bg-white/95 shadow-card transition-all duration-300 sm:rounded-[28px] sm:hover:-translate-y-1 sm:hover:shadow-elevated',
        className
      )}
    >
      {/* Desktop: tall image card */}
      <div className="hidden sm:block">
        <div className="relative h-72 overflow-hidden">
          {process.country.images?.hero?.url ? (
            <Image
              src={process.country.images.hero.url}
              alt={process.country.images.hero.alt || process.country.name}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-sky-wash text-7xl">
              {getFlagEmoji(process.country.iso2Code)}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b1220] via-[#0b1220]/25 to-transparent" />
          <div className="absolute left-4 top-4 flex flex-wrap gap-2">
            <Badge className="border-0 bg-white/85 text-portrait-ink backdrop-blur">
              {process.processTypeLabel || formatProcessType(process.processType)}
            </Badge>
            {isFree && (
              <Badge className="border-0 bg-mint-wash text-portrait-ink">
                Free
              </Badge>
            )}
          </div>
          <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-4">
            <div>
              <p className="mb-2 flex items-center gap-2 text-sm text-white/80">
                <span>{getFlagEmoji(process.country.iso2Code)}</span>
                <span>{process.country.name}</span>
              </p>
              <h3 className="max-w-[14rem] text-xl font-medium leading-tight text-white">
                {process.processName}
              </h3>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-portrait-ink transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1">
              <ArrowUpRight className="h-5 w-5" />
            </span>
          </div>
        </div>
        <div className="space-y-4 p-5">
          <div className="flex items-center justify-between gap-4">
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
          <div className="flex items-center justify-between rounded-[20px] bg-[#f5f7fb] px-4 py-3 text-sm text-slate-helper">
            <span className="inline-flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-nautical-teal" />
              Reviewed for Indian travelers
            </span>
            <span className="font-medium text-portrait-ink">Explore</span>
          </div>
        </div>
      </div>

      {/* Mobile: compact horizontal card */}
      <div className="flex items-center gap-3 p-3 sm:hidden">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl">
          {process.country.images?.hero?.url ? (
            <Image
              src={process.country.images.hero.url}
              alt={process.country.images.hero.alt || process.country.name}
              fill
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-sky-wash text-3xl">
              {getFlagEmoji(process.country.iso2Code)}
            </div>
          )}
          {isFree && (
            <div className="absolute left-1 top-1 rounded-md bg-mint-wash px-1.5 py-0.5 text-[10px] font-medium text-portrait-ink">
              Free
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-xs text-slate-helper">
            <span>{getFlagEmoji(process.country.iso2Code)}</span>
            {process.country.name}
          </p>
          <h3 className="mt-0.5 truncate text-[15px] font-medium text-portrait-ink">
            {process.processName}
          </h3>
          <div className="mt-1.5 flex items-center gap-3">
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
        <ArrowUpRight className="h-5 w-5 shrink-0 text-slate-helper" />
      </div>
    </Link>
  );
}
