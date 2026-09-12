'use client';

import type { Ref } from 'react';
import Link from 'next/link';
import {
  BookOpen,
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
  },
  {
    id: 'passport',
    label: 'Passport',
    href: '/passport',
    Icon: BookOpen,
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
              >
                {'imageSrc' in tab ? (
                  <img
                    src={tab.imageSrc}
                    alt=""
                    width={28}
                    height={28}
                    className="h-16 w-16 object-cover mix-blend-multiply rounded-full"
                    aria-hidden
                  />
                ) : (
                  <tab.Icon className="h-6 w-6" aria-hidden />
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
