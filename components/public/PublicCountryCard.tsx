'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPrice, getCountryCardImage, getFlagEmoji } from '@/lib/public';

export interface HomeCountryListing {
  id: string;
  href: string;
  processName: string;
  startingPrice: number;
  purpose?: string;
}

export interface HomeCountryCardData {
  name: string;
  iso2Code: string;
  href: string;
  startingPrice: number;
  listings: HomeCountryListing[];
  images?: {
    banner?: { url?: string; alt?: string };
    hero?: { url?: string; alt?: string };
  } | null;
}

interface PublicCountryCardProps {
  country: HomeCountryCardData;
  className?: string;
}

export function PublicCountryCard({ country, className }: PublicCountryCardProps) {
  const cardImage = getCountryCardImage(country.images);
  const listingNames = country.listings.map((listing) => listing.processName);
  const extraCount = Math.max(listingNames.length - 2, 0);
  const visibleNames = listingNames.slice(0, 2);

  return (
    <article
      className={cn(
        'group overflow-hidden rounded-2xl border border-ash bg-white/95 shadow-card transition-all duration-300 sm:rounded-[28px] sm:hover:-translate-y-1 sm:hover:shadow-elevated',
        className
      )}
    >
      <Link href={country.href} className="hidden sm:block">
        <div className="relative h-72 overflow-hidden">
          {cardImage ? (
            <Image
              src={cardImage.url}
              alt={cardImage.alt || country.name}
              fill
              sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw"
              className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-sky-wash text-7xl">
              {getFlagEmoji(country.iso2Code)}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b1220] via-[#0b1220]/30 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-4">
            <div>
              <p className="mb-2 text-sm text-white/80" suppressHydrationWarning>
                {getFlagEmoji(country.iso2Code)}
              </p>
              <h3 className="font-basier text-2xl font-medium leading-tight text-white">
                {country.name}
              </h3>
            </div>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/90 text-portrait-ink">
              <ArrowUpRight className="h-5 w-5" />
            </span>
          </div>
        </div>
      </Link>

      <div className="hidden space-y-4 p-5 sm:block">
        <div className="flex flex-wrap gap-2">
          {country.listings.map((listing) => (
            <Link
              key={listing.id}
              href={listing.href}
              className="rounded-full bg-[#f5f7fb] px-3 py-1.5 text-xs font-medium text-portrait-ink transition-colors hover:bg-sky-wash"
            >
              {listing.processName}
            </Link>
          ))}
        </div>
        <div className="flex items-end justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-helper">
            Starting from
          </p>
          <p className="text-lg font-semibold text-portrait-ink">
            {formatPrice(country.startingPrice)}
          </p>
        </div>
      </div>

      <Link href={country.href} className="flex items-center gap-3 p-3 sm:hidden">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl">
          {cardImage ? (
            <Image
              src={cardImage.url}
              alt={cardImage.alt || country.name}
              fill
              sizes="80px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-sky-wash text-3xl">
              {getFlagEmoji(country.iso2Code)}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-1.5 text-[15px] font-medium text-portrait-ink">
            <span suppressHydrationWarning>{getFlagEmoji(country.iso2Code)}</span>
            {country.name}
          </h3>
          <p className="mt-0.5 truncate text-xs text-slate-helper">
            {visibleNames.join(' · ')}
            {extraCount > 0 ? ` · +${extraCount} more` : ''}
          </p>
          <p className="mt-1.5 text-sm font-semibold text-portrait-ink">
            {formatPrice(country.startingPrice)}
          </p>
        </div>
        <ArrowUpRight className="h-5 w-5 shrink-0 text-slate-helper" />
      </Link>
    </article>
  );
}
