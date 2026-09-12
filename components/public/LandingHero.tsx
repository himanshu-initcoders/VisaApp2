'use client';

import { useEffect, useState, type Ref } from 'react';
import Link from 'next/link';
import {
  Briefcase,
  Building2,
  Globe,
  GraduationCap,
  HeartPulse,
  Palmtree,
  Plane,
  Users,
} from 'lucide-react';
import { DestinationSearchBar } from '@/components/public/DestinationSearchBar';
import { cn } from '@/lib/utils';

const PRODUCT_TABS = [
  {
    id: 'visa',
    label: 'Visas',
    href: '#visas',
    imageSrc: '/visa.gif',
    playOnHover: false,
  },
  {
    id: 'passport',
    label: 'Passport',
    href: '/passport',
    imageSrc: '/passport.gif',
    playOnHover: true,
  },
] as const;

const CATEGORY_ICONS = {
  all: Globe,
  tourism: Palmtree,
  business: Briefcase,
  work: Building2,
  study: GraduationCap,
  family: Users,
  medical: HeartPulse,
  transit: Plane,
} as const;

const CATEGORY_LABELS: Record<string, string> = {
  all: 'All',
  tourism: 'Tourism',
  business: 'Business',
  work: 'Work',
  study: 'Study',
  family: 'Family',
  medical: 'Medical',
  transit: 'Transit',
};

function HoverGif({
  src,
  playing,
}: {
  src: string;
  playing: boolean;
}) {
  const [frozenSrc, setFrozenSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const image = new window.Image();
    image.src = src;

    image.onload = () => {
      if (cancelled) return;
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth || image.width;
      canvas.height = image.naturalHeight || image.height;
      const context = canvas.getContext('2d');
      if (!context) return;
      context.drawImage(image, 0, 0);
      setFrozenSrc(canvas.toDataURL('image/png'));
    };

    return () => {
      cancelled = true;
    };
  }, [src]);

  return (
    <span className="relative inline-flex h-16 w-16 shrink-0 mix-blend-multiply">
      {/* Preloaded GIF always underneath — no remount, no blink */}
      <img
        src={src}
        alt=""
        width={64}
        height={64}
        className="absolute inset-0 h-16 w-16 rounded-full object-cover"
        aria-hidden
      />
      {/* Frozen first frame covers it until hover */}
      <img
        src={frozenSrc || src}
        alt=""
        width={64}
        height={64}
        className={cn(
          'absolute inset-0 h-16 w-16 rounded-full object-cover transition-opacity duration-200 ease-out',
          playing ? 'opacity-0' : 'opacity-100'
        )}
        aria-hidden
      />
    </span>
  );
}

export interface LandingHeroProps {
  onSearchOpen: () => void;
  searchRef?: Ref<HTMLDivElement>;
  activeCategory: string;
  onCategoryChange: (id: string) => void;
  availablePurposes: string[];
}

export function LandingHero({
  onSearchOpen,
  searchRef,
  activeCategory,
  onCategoryChange,
  availablePurposes,
}: LandingHeroProps) {
  const [passportPlaying, setPassportPlaying] = useState(false);

  const categories = [
    'all',
    ...availablePurposes.filter((purpose) => purpose in CATEGORY_ICONS),
  ];

  return (
    <section className="bg-[#f8f6f1] pt-24 sm:pt-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="mb-5 flex items-center justify-center gap-8 sm:mb-6">
          {PRODUCT_TABS.map((tab) => {
            const isActive = tab.id === 'visa';
            const imageClassName =
              'h-16 w-16 rounded-full object-cover mix-blend-multiply';

            return (
              <Link
                key={tab.id}
                href={tab.href}
                className={cn(
                  'flex flex-col items-center gap-1.5 pb-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-b-2 border-portrait-ink text-portrait-ink'
                    : 'border-b-2 border-transparent text-slate-helper hover:text-portrait-ink'
                )}
                onMouseEnter={
                  tab.playOnHover
                    ? () => setPassportPlaying(true)
                    : undefined
                }
                onMouseLeave={
                  tab.playOnHover
                    ? () => setPassportPlaying(false)
                    : undefined
                }
                onFocus={
                  tab.playOnHover
                    ? () => setPassportPlaying(true)
                    : undefined
                }
                onBlur={
                  tab.playOnHover
                    ? () => setPassportPlaying(false)
                    : undefined
                }
              >
                {tab.playOnHover ? (
                  <HoverGif
                    src={tab.imageSrc}
                    playing={passportPlaying}
                  />
                ) : (
                  <img
                    src={tab.imageSrc}
                    alt=""
                    width={64}
                    height={64}
                    className={imageClassName}
                    aria-hidden
                  />
                )}
                {tab.label}
              </Link>
            );
          })}
        </div>

        <div ref={searchRef}>
          <DestinationSearchBar variant="hero" onActivate={onSearchOpen} />
        </div>
      </div>

      <div className="mx-auto mt-6 max-w-3xl border-b border-ash px-4 sm:mt-7 sm:px-6">
        <div
          role="tablist"
          aria-label="Visa categories"
          className="flex justify-center gap-1 overflow-x-auto pb-px [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {categories.map((id) => {
            const Icon =
              CATEGORY_ICONS[id as keyof typeof CATEGORY_ICONS] || Globe;
            const isActive = activeCategory === id;

            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onCategoryChange(id)}
                className={cn(
                  'flex min-w-[76px] flex-col items-center gap-1.5 px-3 pb-3 pt-1 text-[11px] font-medium tracking-wide transition-colors sm:min-w-[88px] sm:text-xs',
                  isActive
                    ? 'border-b-2 border-portrait-ink text-portrait-ink'
                    : 'border-b-2 border-transparent text-slate-helper hover:border-ash hover:text-portrait-ink'
                )}
              >
                <Icon className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden />
                {CATEGORY_LABELS[id] || id}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
