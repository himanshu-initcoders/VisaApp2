'use client';

import { MotionReveal } from '@/components/public/MotionReveal';
import { PublicProcessCard } from '@/components/public/PublicProcessCard';

const MAX_ITEMS = 4;

export function ExploreMoreRail({
  items,
}: {
  items: Array<any>;
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

      {/* Mobile: vertical stack */}
      <div className="space-y-3 sm:hidden">
        {visible.map((item, index) => (
          <MotionReveal key={item.id} delayMs={index * 40}>
            <PublicProcessCard process={item} />
          </MotionReveal>
        ))}
      </div>

      {/* Desktop: fixed 4-up grid — no scroll rail */}
      <div className="hidden gap-5 sm:grid sm:grid-cols-2 lg:grid-cols-4">
        {visible.map((item, index) => (
          <MotionReveal key={item.id} delayMs={index * 40}>
            <PublicProcessCard process={item} />
          </MotionReveal>
        ))}
      </div>
    </div>
  );
}
