'use client';

import { MotionReveal } from '@/components/public/MotionReveal';
import {
  PublicCountryCard,
  type HomeCountryCardData,
} from '@/components/public/PublicCountryCard';

const MOBILE_MAX = 4;

export function ExploreMoreRail({
  items,
}: {
  items: HomeCountryCardData[];
}) {
  const mobileItems = items.slice(0, MOBILE_MAX);
  // Two copies so the CSS loop can jump from -50% → 0 seamlessly.
  const marqueeItems = [...items, ...items];
  const durationSec = Math.max(items.length * 4, 24);

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

      {/* Mobile: fixed set of four */}
      <div className="grid gap-3 sm:hidden">
        {mobileItems.map((country, index) => (
          <MotionReveal key={country.iso2Code} delayMs={index * 40}>
            <PublicCountryCard country={country} showExploreFooter />
          </MotionReveal>
        ))}
      </div>

      {/* Desktop: all destinations, continuous RTL marquee */}
      <div
        className="group/marquee relative -mx-4 hidden overflow-hidden sm:block sm:-mx-6 lg:-mx-8 motion-reduce:mx-0 motion-reduce:overflow-x-auto"
        style={{
          maskImage:
            'linear-gradient(to right, transparent, black 4%, black 96%, transparent)',
          WebkitMaskImage:
            'linear-gradient(to right, transparent, black 4%, black 96%, transparent)',
        }}
      >
        <div
          className="flex w-max gap-5 py-1 animate-explore-marquee motion-reduce:animate-none group-hover/marquee:[animation-play-state:paused]"
          style={{ animationDuration: `${durationSec}s` }}
        >
          {marqueeItems.map((country, index) => {
            const isDuplicate = index >= items.length;

            return (
              <div
                key={`${country.iso2Code}-${index}`}
                className={
                  isDuplicate
                    ? 'w-[240px] shrink-0 motion-reduce:hidden md:w-[260px] lg:w-[280px]'
                    : 'w-[240px] shrink-0 md:w-[260px] lg:w-[280px]'
                }
                aria-hidden={isDuplicate}
              >
                <PublicCountryCard country={country} showExploreFooter />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
