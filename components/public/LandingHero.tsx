'use client';

import Link from 'next/link';
import { Search } from 'lucide-react';
import { MotionReveal } from '@/components/public/MotionReveal';

interface LandingHeroProps {
  query: string;
  onQueryChange: (value: string) => void;
}

export function LandingHero({ query, onQueryChange }: LandingHeroProps) {
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
          <div className="relative mx-auto max-w-xl">
            <div className="flex items-center gap-3 rounded-2xl border border-ash-divider bg-white px-4 py-3.5 shadow-elevated transition-shadow focus-within:shadow-[0_0_0_3px_rgba(8,48,76,0.08)] sm:rounded-full sm:px-5 sm:py-4">
              <Search className="h-5 w-5 shrink-0 text-slate-helper" />
              <input
                type="text"
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                placeholder="Search destinations like Dubai or Japan"
                className="min-w-0 flex-1 bg-transparent text-base text-portrait-ink outline-none placeholder:text-slate-helper"
              />
              {query && (
                <button
                  onClick={() => onQueryChange('')}
                  className="shrink-0 rounded-full bg-fog-edge/40 px-3 py-1 text-xs text-slate-helper active:bg-fog-edge/60 sm:bg-transparent sm:px-0 sm:py-0"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </MotionReveal>
      </div>
    </section>
  );
}
