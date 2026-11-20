'use client';

import { MotionReveal } from '@/components/public/MotionReveal';
import {
  PublicCountryCard,
  type HomeCountryCardData,
} from '@/components/public/PublicCountryCard';

const MAX_ITEMS = 4;

export function ExploreMoreRail({
  items,
}: {
  items: HomeCountryCardData[];
}) {
  const visible = items.slice(0, MAX_ITEMS);

  return (
    <div className="space-y-4">
      <MotionReveal>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-helper sm:text-sm">
          More destinations
        </p>
        <h2 className="mt-1.5 font-basier text-2xl text-portrait-ink sm:mt-2 sm:text-3xl">
          Keep exploring.
        </h2>
      </MotionReveal>

      <div className="grid gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
        {visible.map((country, index) => (
          <MotionReveal key={country.iso2Code} delayMs={index * 40}>
            <PublicCountryCard country={country} showExploreFooter />
          </MotionReveal>
        ))}
      </div>
    </div>
  );
}
