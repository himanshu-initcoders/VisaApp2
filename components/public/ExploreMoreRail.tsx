'use client';

import { useEffect, useRef } from 'react';
import { MotionReveal } from '@/components/public/MotionReveal';
import {
  PublicCountryCard,
  type HomeCountryCardData,
} from '@/components/public/PublicCountryCard';

const MOBILE_MAX = 4;
/** Clears site header + sticky section nav while the rail is pinned. */
const STICKY_TOP_PX = 112;

export function ExploreMoreRail({
  items,
}: {
  items: HomeCountryCardData[];
}) {
  const mobileItems = items.slice(0, MOBILE_MAX);
  const pinRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const pin = pinRef.current;
    const sticky = stickyRef.current;
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!pin || !sticky || !viewport || !track || items.length === 0) return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let maxShift = 0;

    const measure = () => {
      // Reset so we measure natural widths.
      track.style.transform = 'translate3d(0, 0, 0)';
      maxShift = Math.max(0, track.scrollWidth - viewport.clientWidth);

      if (mediaQuery.matches || maxShift === 0) {
        pin.style.height = 'auto';
        return;
      }

      // Extra vertical travel == horizontal travel; page stays "stuck" until done.
      pin.style.height = `${sticky.offsetHeight + maxShift}px`;
    };

    const update = () => {
      frame = 0;

      if (mediaQuery.matches || maxShift === 0) {
        track.style.transform = 'translate3d(0, 0, 0)';
        return;
      }

      const rect = pin.getBoundingClientRect();
      const scrolled = STICKY_TOP_PX - rect.top;
      const progress = Math.min(1, Math.max(0, scrolled / maxShift));
      track.style.transform = `translate3d(${-progress * maxShift}px, 0, 0)`;
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    const onResize = () => {
      measure();
      update();
    };

    measure();
    update();

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    mediaQuery.addEventListener('change', onResize);

    const images = track.querySelectorAll('img');
    const onImageLoad = () => onResize();
    images.forEach((img) => {
      if (!img.complete) img.addEventListener('load', onImageLoad, { once: true });
    });

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      mediaQuery.removeEventListener('change', onResize);
      images.forEach((img) => img.removeEventListener('load', onImageLoad));
    };
  }, [items.length]);

  return (
    <div className="space-y-4">
      {/* Mobile: fixed set of four — no pin scroll */}
      <div className="space-y-4 sm:hidden">
        <MotionReveal>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-helper">
            More destinations
          </p>
          <h2 className="mt-1.5 font-basier text-2xl text-portrait-ink">
            Keep exploring.
          </h2>
        </MotionReveal>
        <div className="grid gap-3">
          {mobileItems.map((country, index) => (
            <MotionReveal key={country.iso2Code} delayMs={index * 40}>
              <PublicCountryCard country={country} showExploreFooter />
            </MotionReveal>
          ))}
        </div>
      </div>

      {/* Desktop: pin section until visas finish RTL travel */}
      <div ref={pinRef} className="relative hidden sm:block">
        {/*
          Break out of page px gutters so bg-white covers the full content column
          (avoids the grey strip beside the sticky panel). Padding restored for type.
        */}
        <div
          ref={stickyRef}
          className="sticky -mx-4 space-y-4 bg-white px-4 py-4 sm:-mx-6 sm:px-6 sm:py-6 lg:-mx-8 lg:px-8"
          style={{ top: STICKY_TOP_PX }}
        >
          <MotionReveal>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-helper sm:text-sm">
              More destinations
            </p>
            <h2 className="mt-1.5 font-basier text-2xl text-portrait-ink sm:mt-2 sm:text-3xl">
              Keep exploring.
            </h2>
          </MotionReveal>

          <div
            ref={viewportRef}
            className="relative overflow-hidden motion-reduce:overflow-x-auto"
            style={{
              maskImage:
                'linear-gradient(to right, transparent, black 3%, black 97%, transparent)',
              WebkitMaskImage:
                'linear-gradient(to right, transparent, black 3%, black 97%, transparent)',
            }}
          >
            <div
              ref={trackRef}
              className="flex w-max gap-5 py-1 will-change-transform"
            >
              {items.map((country) => (
                <div
                  key={country.iso2Code}
                  className="w-[240px] shrink-0 md:w-[260px] lg:w-[280px]"
                >
                  <PublicCountryCard country={country} showExploreFooter />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
