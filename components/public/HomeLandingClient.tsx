'use client';

import { useMemo, useState } from 'react';
import { LandingHero } from '@/components/public/LandingHero';
import { MotionReveal } from '@/components/public/MotionReveal';
import { PublicProcessCard } from '@/components/public/PublicProcessCard';

interface HomeProcess {
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
}

interface HomeLandingClientProps {
  processes: HomeProcess[];
}

export function HomeLandingClient({ processes }: HomeLandingClientProps) {
  const [query, setQuery] = useState('');

  const filteredProcesses = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return processes;
    }

    return processes.filter((process) => {
      const haystack = [
        process.country.name,
        process.processName,
        process.processType,
        process.processTypeLabel,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [processes, query]);

  return (
    <>
      <LandingHero query={query} onQueryChange={setQuery} />

      <section
        className="mx-auto max-w-7xl px-4 pb-8 pt-6 sm:px-6 sm:pb-12 sm:pt-10 lg:px-8"
        id="visas"
      >
        {filteredProcesses.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ash-divider bg-white px-5 py-12 text-center shadow-card sm:rounded-[32px] sm:px-6 sm:py-16">
            <h3 className="text-xl font-medium text-portrait-ink sm:text-2xl">
              No matches found.
            </h3>
            <p className="mt-2 text-[15px] text-slate-helper sm:mt-3 sm:text-base">
              Try another country name or clear the search to see all visa
              options again.
            </p>
          </div>
        ) : (
          <div className="space-y-3 sm:grid sm:grid-cols-2 sm:gap-6 sm:space-y-0 xl:grid-cols-4">
            {filteredProcesses.map((process, index) => (
              <MotionReveal key={process.id} delayMs={Math.min(index * 40, 240)}>
                <PublicProcessCard process={process} />
              </MotionReveal>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
