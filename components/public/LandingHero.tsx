'use client';

import type { Ref } from 'react';
import Link from 'next/link';
import { DestinationSearchBar } from '@/components/public/DestinationSearchBar';
import { MotionReveal } from '@/components/public/MotionReveal';

interface LandingHeroProps {
  onSearchOpen: () => void;
  searchRef?: Ref<HTMLDivElement>;
}

export function LandingHero({ onSearchOpen, searchRef }: LandingHeroProps) {
  return (
    <section className="relative overflow-hidden bg-white px-4 pb-16 pt-24 sm:px-6 sm:pb-24 sm:pt-28 lg:px-8">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(38,192,255,0.08),transparent_50%),radial-gradient(ellipse_at_80%_0%,rgba(230,0,194,0.06),transparent_40%)]" />

      <div className="relative mx-auto max-w-3xl text-center">
        <MotionReveal>
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            <Link
              href="#visas"
              className="rounded-full border border-ash-divider bg-white px-4 py-2 text-sm font-medium text-portrait-ink shadow-card transition-all active:scale-95 sm:hover:border-portrait-ink/20 sm:hover:shadow-elevated"
            >
              Visa for Indians
            </Link>

            <Link
              href="/passport"
              className="rounded-full border border-ash-divider bg-white px-4 py-2 text-sm font-medium text-slate-helper shadow-card transition-all active:scale-95 sm:hover:border-portrait-ink/20 sm:hover:text-portrait-ink sm:hover:shadow-elevated"
            >
              Apply for Indian passport
            </Link>
          </div>
        </MotionReveal>

        <MotionReveal delayMs={100} className="mt-7 sm:mt-10">
          <div ref={searchRef} className="mx-auto max-w-xl">
            <DestinationSearchBar variant="hero" onActivate={onSearchOpen} />
          </div>
        </MotionReveal>
      </div>
    </section>
  );
}
