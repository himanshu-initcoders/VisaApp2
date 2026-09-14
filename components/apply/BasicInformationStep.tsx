'use client';

import { useState } from 'react';
import { ArrowRight, UserRound } from 'lucide-react';
import { PassportHeroIllustration } from '@/components/apply/PassportHeroIllustration';
import { PreviousProfilesCarousel } from '@/components/apply/PreviousProfilesCarousel';
import type { TravellerProfile } from '@/lib/apply/travellerProfiles';
import { cn } from '@/lib/utils';

interface BasicInformationStepProps {
  primaryName: string;
  onNameChange: (value: string) => void;
  onContinue: () => void;
  onSelectProfile: (profile: TravellerProfile) => void;
  profiles: TravellerProfile[];
}

export function BasicInformationStep({
  primaryName,
  onNameChange,
  onContinue,
  onSelectProfile,
  profiles,
}: BasicInformationStepProps) {
  const [attempted, setAttempted] = useState(false);
  const empty = !primaryName.trim();

  const handleNext = () => {
    if (empty) {
      setAttempted(true);
      document.getElementById('apply-full-name')?.focus();
      return;
    }
    onContinue();
  };

  return (
    <section className="mx-auto w-full max-w-5xl">
      <div className="relative overflow-hidden rounded-[24px] border border-white bg-white px-5 py-6 shadow-card sm:px-8 sm:py-8">
        <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_240px]">
          <div className="min-w-0">
            <div className="flex items-start gap-3 sm:gap-4">
              <span className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#eef4ff] text-[#3b82f6]">
                <UserRound className="h-6 w-6" />
              </span>
              <div>
                <h1 className="font-switzer text-xl font-semibold text-portrait-ink sm:text-2xl">
                  Basic Information
                </h1>
                <p className="mt-1 text-sm text-slate-helper">
                  Please enter your full name as it appears on your passport.
                </p>
              </div>
            </div>

            <div className="mt-8">
              <label
                htmlFor="apply-full-name"
                className="mb-2 block text-sm font-medium text-portrait-ink"
              >
                Full Name
              </label>
              <div
                className={cn(
                  'flex items-center gap-2 rounded-full border bg-white pl-4 pr-1.5 py-1.5 transition-colors',
                  attempted && empty
                    ? 'border-[#ff4940]'
                    : 'border-ash focus-within:border-[#3b82f6]'
                )}
              >
                <UserRound className="h-4 w-4 shrink-0 text-fog" />
                <input
                  id="apply-full-name"
                  value={primaryName}
                  onChange={(event) => {
                    onNameChange(
                      event.target.value.replace(/[^a-zA-Z\s]/g, '')
                    );
                    if (attempted) setAttempted(false);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') handleNext();
                  }}
                  placeholder="Enter your full name"
                  autoFocus
                  autoComplete="name"
                  className="min-w-0 flex-1 bg-transparent py-2 font-switzer text-sm text-portrait-ink outline-none placeholder:text-fog sm:text-base"
                />
                <button
                  type="button"
                  onClick={handleNext}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#3b82f6] px-4 py-2 text-sm font-medium text-white shadow-[0_6px_16px_rgba(59,130,246,0.28)] transition-opacity hover:opacity-90"
                >
                  Next
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
              {attempted && empty && (
                <p className="mt-2 text-xs text-[#ff4940]">
                  Enter your full name to continue.
                </p>
              )}
            </div>
          </div>

          <PassportHeroIllustration className="mx-auto hidden h-[200px] w-[240px] lg:block" />
        </div>
      </div>

      <PreviousProfilesCarousel
        profiles={profiles}
        onSelect={onSelectProfile}
      />
    </section>
  );
}
