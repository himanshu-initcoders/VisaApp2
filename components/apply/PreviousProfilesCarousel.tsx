'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, MoveHorizontal } from 'lucide-react';
import { ProfileAvatar } from '@/components/apply/ProfileAvatar';
import { getFlagEmoji } from '@/lib/public';
import type { TravellerProfile } from '@/lib/apply/travellerProfiles';
import { cn } from '@/lib/utils';

interface PreviousProfilesCarouselProps {
  profiles: TravellerProfile[];
  onSelect: (profile: TravellerProfile) => void;
}

export function PreviousProfilesCarousel({
  profiles,
  onSelect,
}: PreviousProfilesCarouselProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const updateArrows = () => {
    const node = scrollerRef.current;
    if (!node) return;
    setCanPrev(node.scrollLeft > 8);
    setCanNext(node.scrollLeft + node.clientWidth < node.scrollWidth - 8);
  };

  useEffect(() => {
    updateArrows();
    const node = scrollerRef.current;
    if (!node) return;
    node.addEventListener('scroll', updateArrows, { passive: true });
    window.addEventListener('resize', updateArrows);
    return () => {
      node.removeEventListener('scroll', updateArrows);
      window.removeEventListener('resize', updateArrows);
    };
  }, [profiles]);

  const scrollByCard = (direction: -1 | 1) => {
    const node = scrollerRef.current;
    if (!node) return;
    node.scrollBy({ left: direction * 260, behavior: 'smooth' });
  };

  if (profiles.length === 0) return null;

  return (
    <section className="mt-8 sm:mt-10">
      <div className="mb-4 flex items-end justify-between gap-3 px-1">
        <h2 className="font-switzer text-lg font-semibold text-portrait-ink sm:text-xl">
          Your Previous Profiles
        </h2>
        {profiles.length > 3 && (
          <p className="hidden items-center gap-1.5 text-xs text-slate-helper sm:inline-flex">
            <MoveHorizontal className="h-3.5 w-3.5" />
            Scroll to view more
          </p>
        )}
      </div>

      <div className="relative">
        <button
          type="button"
          aria-label="Previous profiles"
          disabled={!canPrev}
          onClick={() => scrollByCard(-1)}
          className={cn(
            'absolute -left-3 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white bg-white text-slate-helper shadow-card transition-opacity sm:flex',
            !canPrev && 'pointer-events-none opacity-0'
          )}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <div
          ref={scrollerRef}
          className="flex gap-4 overflow-x-auto pb-2 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {profiles.map((profile) => (
            <button
              key={profile.id}
              type="button"
              onClick={() => onSelect(profile)}
              className="group flex min-w-[240px] max-w-[240px] shrink-0 items-center gap-3 rounded-[24px] border border-white bg-white px-4 py-4 text-left shadow-card transition-transform hover:-translate-y-0.5"
            >
              <ProfileAvatar
                name={profile.name}
                variant={profile.avatarVariant}
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-start justify-between gap-2">
                  <span className="truncate font-switzer text-sm font-semibold text-portrait-ink">
                    {profile.name}
                  </span>
                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-fog transition-colors group-hover:text-[#3b82f6]" />
                </span>
                <span className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-helper">
                  <span aria-hidden>{getFlagEmoji(profile.countryCode)}</span>
                  {profile.nationality}
                </span>
                <span className="mt-2 inline-flex rounded-full bg-[#eef4ff] px-2.5 py-0.5 text-[11px] font-medium text-[#3b82f6]">
                  {profile.visaType}
                </span>
              </span>
            </button>
          ))}
        </div>

        <button
          type="button"
          aria-label="Next profiles"
          disabled={!canNext}
          onClick={() => scrollByCard(1)}
          className={cn(
            'absolute -right-3 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white bg-white text-slate-helper shadow-card transition-opacity sm:flex',
            !canNext && 'pointer-events-none opacity-0'
          )}
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </section>
  );
}
