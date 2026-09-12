'use client';

import { useMemo, useState } from 'react';
import { AnimatedStatValue } from '@/components/ui/AnimatedStatValue';
import { MotionReveal } from '@/components/public/MotionReveal';
import {
  PricingPanel,
  type PriceOptionView,
  type VisaKindOption,
} from '@/components/public/PricingPanel';

function stayValue(option?: PriceOptionView, fallback?: string | null) {
  return (
    option?.stayDuration ||
    option?.daysLabel ||
    option?.entryValidity ||
    fallback ||
    'Check rules'
  );
}

interface ListingOverviewSectionProps {
  overview: string;
  processingEta: string | null;
  fallbackStay: string | null;
  isFree: boolean;
  countryCode: string;
  listingId: string;
  priceOptions: PriceOptionView[];
  headline?: string;
  visaKinds?: VisaKindOption[];
}

function OverviewStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="shrink-0 rounded-2xl border border-ash-divider bg-white p-4 shadow-card sm:rounded-[26px] sm:p-5">
      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-helper sm:text-xs">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold text-portrait-ink sm:mt-3 sm:text-2xl">
        <AnimatedStatValue value={value} />
      </p>
    </div>
  );
}

export function ListingOverviewSection({
  overview,
  processingEta,
  fallbackStay,
  isFree,
  countryCode,
  listingId,
  priceOptions,
  headline,
  visaKinds = [],
}: ListingOverviewSectionProps) {
  const [selectedId, setSelectedId] = useState(priceOptions[0]?.id);
  const selected = useMemo(
    () => priceOptions.find((option) => option.id === selectedId) || priceOptions[0],
    [priceOptions, selectedId]
  );

  const startingPrice = isFree
    ? 'FREE'
    : selected?.formattedTotal || 'On request';

  return (
    <section
      id="overview"
      className="space-y-6 sm:space-y-0 lg:grid lg:grid-cols-[1fr_0.95fr] lg:gap-8"
    >
      <MotionReveal className="space-y-3 sm:space-y-4">
        <p className="text-xs uppercase tracking-[0.24em] text-slate-helper sm:text-sm">
          Product overview
        </p>
        <h2 className="font-basier text-2xl leading-tight text-portrait-ink sm:text-4xl">
          Know what this product is, who it helps, and how fast it moves.
        </h2>
        <p className="max-w-2xl text-[15px] leading-7 text-slate-helper sm:text-base sm:leading-8">
          {overview}
        </p>
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0">
          <OverviewStat label="Starting price" value={startingPrice} />
          <OverviewStat
            label="Processing"
            value={processingEta || 'Varies'}
          />
          <OverviewStat
            label="Stay duration"
            value={stayValue(selected, fallbackStay)}
          />
        </div>
      </MotionReveal>

      <div id="pricing" className="scroll-mt-28 sm:scroll-mt-32">
        <PricingPanel
          compact
          countryCode={countryCode}
          listingId={listingId}
          isFree={isFree}
          priceOptions={priceOptions}
          headline={headline}
          visaKinds={visaKinds}
          currentListingId={listingId}
          selectedId={selected?.id}
          onSelectedIdChange={setSelectedId}
        />
      </div>
    </section>
  );
}
