'use client';

import { useEffect, useRef, useState } from 'react';
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

  const openSearch = () => setIsSearchOpen(true);
  const closeSearch = () => {
    setIsSearchOpen(false);
    setQuery('');
  };

  return (
    <>
      <Header
        overlay
        center={
          isSearchStuck && !isSearchOpen ? (
            <DestinationSearchBar variant="nav" onActivate={openSearch} />
          ) : undefined
        }
      />

      <LandingHero onSearchOpen={openSearch} searchRef={heroSearchRef} />

      {isSearchOpen && (
        <CountrySearchOverlay
          processes={processes}
          query={query}
          onQueryChange={setQuery}
          onClose={closeSearch}
        />
      )}

      <section
        className="mx-auto max-w-7xl px-4 pb-8 pt-6 sm:px-6 sm:pb-12 sm:pt-10 lg:px-8"
        id="visas"
      >
        <div className="space-y-3 sm:grid sm:grid-cols-2 sm:gap-6 sm:space-y-0 xl:grid-cols-4">
          {countries.map((country, index) => (
            <MotionReveal key={country.iso2Code} delayMs={Math.min(index * 40, 240)}>
              <PublicCountryCard country={country} />
            </MotionReveal>
          ))}
        </div>
      </section>
    </>
  );
}
