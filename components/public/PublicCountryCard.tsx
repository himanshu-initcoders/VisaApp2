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
  const listingLine =
    visibleNames.join(' · ') + (extraCount > 0 ? ` · +${extraCount}` : '');

  return (
    <article
      className={cn(
        'group overflow-hidden rounded-2xl shadow-card transition-all duration-300 sm:rounded-[28px] sm:hover:-translate-y-1 sm:hover:shadow-elevated',
        className
      )}
    >
      <Link
        href={country.href}
        className="relative block aspect-[4/5] overflow-hidden sm:aspect-[3/4]"
      >
        {cardImage ? (
          <Image
            src={cardImage.url}
            alt={cardImage.alt || country.name}
            fill
            sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-sky-wash text-7xl">
            <span suppressHydrationWarning>{getFlagEmoji(country.iso2Code)}</span>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-[#062445]/90 via-[#062445]/35 to-transparent" />

        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 sm:p-5">
          <div className="min-w-0">
            <p className="truncate text-[11px] font-medium uppercase tracking-[0.16em] text-white/70 sm:text-xs">
              {listingLine}
            </p>
            <h3 className="mt-1.5 font-serif text-[1.75rem] leading-[1.05] tracking-[-0.02em] text-white sm:text-[2rem]">
              {country.name}
            </h3>
            <p className="mt-2 text-sm font-medium text-white/90">
              From {formatPrice(country.startingPrice)}
            </p>
          </div>

          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/95 text-portrait-ink transition-transform duration-300 group-hover:scale-105">
            <ArrowUpRight className="h-5 w-5" />
          </span>
        </div>
      </Link>
    </article>
  );
}
