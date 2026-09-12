'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { CountrySearchOverlay } from '@/components/public/CountrySearchOverlay';
import { DestinationSearchBar } from '@/components/public/DestinationSearchBar';
import { LandingHero } from '@/components/public/LandingHero';
import { MotionReveal } from '@/components/public/MotionReveal';
import {
  PublicCountryCard,
  type HomeCountryCardData,
} from '@/components/public/PublicCountryCard';
import { Header } from '@/components/layout/Header';

interface HomeProcess {
  id: string;
  href: string;
  processName: string;
  processType: string;
  processTypeLabel?: string | null;
  formattedStartingPrice: string;
  standardEta?: string | null;
  standardEtaDuration?: number | null;
  standardEtaUnit?: string | null;
  startingPrice: number;
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
      flag?: {
        url?: string;
      };
    } | null;
  };
}

interface HomeLandingClientProps {
  countries: HomeCountryCardData[];
  processes: HomeProcess[];
}

export function HomeLandingClient({
  countries,
  processes,
}: HomeLandingClientProps) {
  const [query, setQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSearchStuck, setIsSearchStuck] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const heroSearchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const heroSearch = heroSearchRef.current;
    if (!heroSearch) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsSearchStuck(!entry.isIntersecting);
      },
      { threshold: 0, rootMargin: '-72px 0px 0px 0px' }
    );

    observer.observe(heroSearch);
    return () => observer.disconnect();
  }, []);

  const availablePurposes = useMemo(() => {
    const seen = new Set<string>();
    for (const country of countries) {
      for (const listing of country.listings) {
        if (listing.purpose) seen.add(listing.purpose);
      }
    }
    return ['tourism', 'business', 'work', 'study', 'family', 'medical', 'transit'].filter(
      (purpose) => seen.has(purpose)
    );
  }, [countries]);

  const visibleCountries = useMemo(() => {
    if (activeCategory === 'all') return countries;
    return countries.filter((country) =>
      country.listings.some((listing) => listing.purpose === activeCategory)
    );
  }, [activeCategory, countries]);

  const openSearch = () => setIsSearchOpen(true);
  const closeSearch = () => {
    setIsSearchOpen(false);
    setQuery('');
  };

  return (
    <>
      <Header
        center={
          isSearchStuck && !isSearchOpen ? (
            <DestinationSearchBar variant="nav" onActivate={openSearch} />
          ) : undefined
        }
      />

      <LandingHero
        onSearchOpen={openSearch}
        searchRef={heroSearchRef}
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
        availablePurposes={availablePurposes}
      />

      {isSearchOpen && (
        <CountrySearchOverlay
          processes={processes}
          query={query}
          onQueryChange={setQuery}
          onClose={closeSearch}
        />
      )}

      <section
        className="mx-auto max-w-7xl px-4 pb-8 pt-6 sm:px-6 sm:pb-12 sm:pt-8 lg:px-8"
        id="visas"
      >
        {visibleCountries.length > 0 ? (
          <div className="space-y-3 sm:grid sm:grid-cols-2 sm:gap-6 sm:space-y-0 xl:grid-cols-4">
            {visibleCountries.map((country, index) => (
              <MotionReveal
                key={country.iso2Code}
                delayMs={Math.min(index * 40, 240)}
              >
                <PublicCountryCard country={country} />
              </MotionReveal>
            ))}
          </div>
        ) : (
          <p className="rounded-3xl border border-ash bg-white px-5 py-8 text-sm text-slate-helper">
            No destinations in this category yet. Try another icon or search
            above.
          </p>
        )}

        <Link
          href="/destinations"
          className="mt-5 inline-flex items-center text-sm font-medium text-portrait-ink"
        >
          View all destinations
          <ArrowRight className="ml-1 h-4 w-4" />
        </Link>
      </section>
    </>
  );
}
