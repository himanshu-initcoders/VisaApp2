'use client';

import { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft, Sparkles } from 'lucide-react';
import { DestinationSearchBar } from '@/components/public/DestinationSearchBar';
import {
  formatGuaranteedOnDate,
  formatPrice,
  formatProcessType,
  getFlagEmoji,
} from '@/lib/public';

export interface SearchableProcess {
  id: string;
  href: string;
  processName: string;
  processType: string;
  processTypeLabel?: string | null;
  startingPrice: number;
  standardEtaDuration?: number | null;
  standardEtaUnit?: string | null;
  country: {
    name: string;
    iso2Code: string;
    images?: {
      hero?: { url?: string; alt?: string };
      flag?: { url?: string };
    } | null;
  };
}

interface CountrySearchResult {
  iso2Code: string;
  name: string;
  href: string;
  processTypeLabel: string;
  startingPrice: number;
  formattedFee: string;
  guaranteedOn: string | null;
  imageUrl?: string;
  imageAlt?: string;
  flagUrl?: string;
  processNames: string[];
}

interface CountrySearchOverlayProps {
  processes: SearchableProcess[];
  query: string;
  onQueryChange: (value: string) => void;
  onClose: () => void;
}

function groupCountries(processes: SearchableProcess[]): CountrySearchResult[] {
  const countries = new Map<string, CountrySearchResult>();

  for (const process of processes) {
    const key = process.country.iso2Code;
    const existing = countries.get(key);
    const processTypeLabel =
      process.processTypeLabel || formatProcessType(process.processType);

    if (!existing) {
      countries.set(key, {
        iso2Code: key,
        name: process.country.name,
        href: process.href,
        processTypeLabel,
        startingPrice: process.startingPrice,
        formattedFee: formatPrice(process.startingPrice),
        guaranteedOn: formatGuaranteedOnDate(
          process.standardEtaDuration,
          process.standardEtaUnit
        ),
        imageUrl: process.country.images?.hero?.url,
        imageAlt: process.country.images?.hero?.alt || process.country.name,
        flagUrl: process.country.images?.flag?.url,
        processNames: [process.processName],
      });
      continue;
    }

    existing.processNames.push(process.processName);

    if (process.startingPrice < existing.startingPrice) {
      existing.href = process.href;
      existing.processTypeLabel = processTypeLabel;
      existing.startingPrice = process.startingPrice;
      existing.formattedFee = formatPrice(process.startingPrice);
      existing.guaranteedOn = formatGuaranteedOnDate(
        process.standardEtaDuration,
        process.standardEtaUnit
      );
    }
  }

  return [...countries.values()].sort((first, second) =>
    first.name.localeCompare(second.name)
  );
}

export function CountrySearchOverlay({
  processes,
  query,
  onQueryChange,
  onClose,
}: CountrySearchOverlayProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const countries = useMemo(() => groupCountries(processes), [processes]);

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return countries;

    return countries.filter((country) => {
      const haystack = [
        country.name,
        country.processTypeLabel,
        ...country.processNames,
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalized);
    });
  }, [countries, query]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    inputRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  const overlay = (
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-white"
      role="dialog"
      aria-modal="true"
      aria-labelledby="country-search-title"
    >
      <div className="border-b border-mist">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-ash-divider bg-white text-portrait-ink shadow-card transition-transform active:scale-95"
            aria-label="Close search"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <DestinationSearchBar
            variant="panel"
            query={query}
            onQueryChange={onQueryChange}
            inputRef={inputRef}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
          <p
            id="country-search-title"
            className="flex items-center justify-center gap-1.5 text-xs font-medium uppercase tracking-[0.18em] text-slate-helper"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {query.trim() ? 'Matching countries' : 'Trending Countries'}
          </p>

          {results.length === 0 ? (
            <div className="mt-10 rounded-2xl border border-dashed border-ash-divider px-5 py-12 text-center">
              <p className="text-lg font-medium text-portrait-ink">
                No countries found.
              </p>
              <p className="mt-2 text-sm text-slate-helper">
                Try another country name, or clear search to see trending visas.
              </p>
            </div>
          ) : (
            <ul className="mt-8 divide-y divide-mist">
              {results.map((country) => (
                <li key={country.iso2Code} className="py-5 first:pt-0">
                  <div className="flex items-center gap-4 sm:gap-5">
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl sm:h-24 sm:w-24">
                      {country.imageUrl ? (
                        <Image
                          src={country.imageUrl}
                          alt={country.imageAlt || country.name}
                          fill
                          sizes="96px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-sky-wash text-3xl">
                          {getFlagEmoji(country.iso2Code)}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {country.flagUrl ? (
                          <Image
                            src={country.flagUrl}
                            alt=""
                            width={20}
                            height={14}
                            className="h-3.5 w-5 rounded-sm object-cover"
                          />
                        ) : (
                          <span className="text-base leading-none">
                            {getFlagEmoji(country.iso2Code)}
                          </span>
                        )}
                        <h3 className="truncate font-basier text-base font-medium uppercase tracking-[0.04em] text-portrait-ink sm:text-lg">
                          {country.name}
                        </h3>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3 sm:text-sm">
                        {country.guaranteedOn && (
                          <div>
                            <p className="text-slate-helper">Guaranteed Visa On:</p>
                            <p className="mt-0.5 font-medium text-portrait-ink">
                              {country.guaranteedOn}
                            </p>
                          </div>
                        )}
                        <div>
                          <p className="text-slate-helper">Type:</p>
                          <p className="mt-0.5 font-medium text-portrait-ink">
                            {country.processTypeLabel}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-helper">Fees:</p>
                          <p className="mt-0.5 font-medium text-portrait-ink">
                            {country.formattedFee}
                          </p>
                        </div>
                      </div>
                    </div>

                    <Link
                      href={country.href}
                      className="hidden shrink-0 rounded-full border-[1.5px] border-portrait-ink px-5 py-2 text-sm font-medium text-portrait-ink transition-colors hover:bg-portrait-ink hover:text-white sm:inline-flex"
                    >
                      Get Visa
                    </Link>
                  </div>

                  <Link
                    href={country.href}
                    className="mt-3 flex h-10 items-center justify-center rounded-full border-[1.5px] border-portrait-ink text-sm font-medium text-portrait-ink sm:hidden"
                  >
                    Get Visa
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(overlay, document.body);
}
