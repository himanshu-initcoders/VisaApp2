'use client';

import { MotionReveal } from '@/components/public/MotionReveal';

export type ListingKeyFact = {
  label: string;
  value: string;
};

interface ListingKeyFactsProps {
  facts: ListingKeyFact[];
}

/**
 * Plain, quotable facts for AEO/GEO — definition list above listing overview.
 * Not a marketing card; keep copy factual for AI citations.
 */
export function ListingKeyFacts({ facts }: ListingKeyFactsProps) {
  if (facts.length === 0) return null;

  return (
    <MotionReveal>
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {facts.map((fact) => (
          <div
            key={fact.label}
            className="border-b border-ash-divider/80 pb-3 sm:border-0 sm:pb-0"
          >
            <dt className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-helper">
              {fact.label}
            </dt>
            <dd className="mt-1.5 text-[15px] font-medium leading-snug text-portrait-ink sm:text-base">
              {fact.value}
            </dd>
          </div>
        ))}
      </dl>
    </MotionReveal>
  );
}
