'use client';

import { MotionReveal } from '@/components/public/MotionReveal';
import { PublicProcessCard } from '@/components/public/PublicProcessCard';

export function ExploreMoreRail({
  items,
}: {
  items: Array<any>;
}) {
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

      {/* Mobile: vertical stack (cards are already compact on mobile) */}
      <div className="space-y-3 sm:hidden">
        {items.slice(0, 4).map((item, index) => (
          <MotionReveal key={item.id} delayMs={index * 40}>
            <PublicProcessCard process={item} />
          </MotionReveal>
        ))}
      </div>

      {/* Desktop: horizontal scroll */}
      <div className="hidden overflow-x-auto pb-2 sm:block">
        <div className="grid min-w-max grid-flow-col gap-5">
          {items.map((item, index) => (
            <MotionReveal key={item.id} delayMs={index * 40} className="w-[310px]">
              <PublicProcessCard process={item} />
            </MotionReveal>
          ))}
        </div>
      </div>
    </div>
  );
}
