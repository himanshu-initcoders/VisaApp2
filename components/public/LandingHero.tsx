'use client';

import { useEffect, useRef, useState, type Ref } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Briefcase,
  Building2,
  Globe,
  GraduationCap,
  HeartPulse,
  MapPin,
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
    videoSrc: '/visa.mp4',
    posterSrc: '/visa.gif',
    playOnHover: false,
  },
  {
    id: 'passport',
    label: 'Passport',
    href: '/passport',
    videoSrc: '/passport.mp4',
    posterSrc: '/passport.gif',
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
  visa_on_arrival: MapPin,
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
  visa_on_arrival: 'Arrival Card',
};

function ProductVideo({
  src,
  poster,
  autoPlay,
  playing,
}: {
  src: string;
  poster?: string;
  autoPlay: boolean;
  playing?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  // Defer network fetch until after first paint so videos don't contend with LCP.
  // Still load play-on-hover videos so their first frame is visible before hover.
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    if (playing) {
      setShouldLoad(true);
      return;
    }

    const win = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (typeof win.requestIdleCallback === 'function') {
      const id = win.requestIdleCallback(() => setShouldLoad(true), {
        timeout: 2000,
      });
      return () => win.cancelIdleCallback?.(id);
    }
    const timer = window.setTimeout(() => setShouldLoad(true), 1200);
    return () => window.clearTimeout(timer);
  }, [playing]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !shouldLoad) return;

    if (autoPlay || playing) {
      void video.play().catch(() => {});
      return;
    }

    video.pause();
    // Tiny seek paints a still frame; currentTime=0 alone is often blank until play.
    const showStill = () => {
      try {
        video.currentTime = 0.001;
      } catch {
        // Ignore seek before metadata is ready.
      }
    };
    if (video.readyState >= 1) {
      showStill();
    } else {
      video.addEventListener('loadedmetadata', showStill, { once: true });
      return () => video.removeEventListener('loadedmetadata', showStill);
    }
  }, [autoPlay, playing, shouldLoad]);

  return (
    <video
      ref={videoRef}
      src={shouldLoad ? src : undefined}
      poster={poster}
      muted
      loop
      playsInline
      autoPlay={autoPlay}
      preload="metadata"
      className="h-16 w-16 shrink-0 rounded-full object-cover mix-blend-multiply"
      aria-hidden
    />
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
    <section className="relative overflow-hidden pt-24 sm:pt-28">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {/* Pre-compressed WebP: skip optimizer so LCP preload URL matches the img. */}
        <Image
          src="/hero.webp"
          alt=""
          fill
          unoptimized
          loading="eager"
          fetchPriority="high"
          sizes="100vw"
          className="object-cover object-[center_30%]"
        />
        <div className="absolute inset-0 bg-[#f8f6f1]/35" />
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-b from-transparent to-[#f8f6f1]" />
      </div>

      <div className="relative z-10 mx-auto max-w-3xl px-4 sm:px-6">
        <div className="mb-5 flex items-center justify-center gap-8 sm:mb-6">
          {PRODUCT_TABS.map((tab) => {
            const isActive = tab.id === 'visa';

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
                <ProductVideo
                  src={tab.videoSrc}
                  poster={tab.posterSrc}
                  autoPlay={!tab.playOnHover}
                  playing={tab.playOnHover ? passportPlaying : undefined}
                />
                {tab.label}
              </Link>
            );
          })}
        </div>

        <div ref={searchRef}>
          <DestinationSearchBar variant="hero" onActivate={onSearchOpen} />
        </div>
      </div>

      {/* <div className="relative z-10 mx-auto mt-6 max-w-3xl border-b border-ash/80 px-4 sm:mt-7 sm:px-6">
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
      </div> */}
    </section>
  );
}
