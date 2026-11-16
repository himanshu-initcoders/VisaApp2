'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { MotionReveal } from '@/components/public/MotionReveal';
import {
  PricingPanel,
  type ApplyPath,
  type PriceOptionView,
  type VisaKindOption,
} from '@/components/public/PricingPanel';
import { VisaTypesOffered } from '@/components/public/VisaTypesOffered';

interface ListingOverviewSectionProps {
  overview: string;
  processingEta: string | null;
  fallbackStay: string | null;
  isFree: boolean;
  visaFree?: boolean;
  officialPortalUrl?: string | null;
  withFreeInsurance?: boolean;
  countryCode: string;
  countryName: string;
  listingId: string;
  listingSlug: string;
  priceOptions: PriceOptionView[];
  headline?: string;
  isMultipleEntry?: boolean;
  visaKinds?: VisaKindOption[];
  onVisaKindSelect?: (kind: VisaKindOption) => Promise<boolean> | boolean;
}

export function ListingOverviewSection({
  processingEta,
  isFree,
  visaFree = false,
  officialPortalUrl = null,
  withFreeInsurance = false,
  countryCode,
  countryName,
  listingId,
  listingSlug,
  priceOptions,
  headline,
  isMultipleEntry = false,
  visaKinds = [],
  onVisaKindSelect,
}: ListingOverviewSectionProps) {
  const [selectedId, setSelectedId] = useState(priceOptions[0]?.id);
  const [applyPath, setApplyPath] = useState<ApplyPath>('viserv');

  useEffect(() => {
    if (!priceOptions.some((option) => option.id === selectedId)) {
      setSelectedId(priceOptions[0]?.id);
    }
  }, [priceOptions, selectedId]);

  const selected = useMemo(
    () => priceOptions.find((option) => option.id === selectedId) || priceOptions[0],
    [priceOptions, selectedId]
  );

  return (
    <section
      id="overview"
      className="space-y-6 sm:space-y-0 lg:grid lg:grid-cols-[1fr_0.95fr] lg:gap-8"
    >
      <MotionReveal>
        <VisaTypesOffered
          countryName={countryName}
          processingEta={processingEta}
          isMultipleEntry={isMultipleEntry}
          priceOptions={priceOptions}
          selectedId={selected?.id}
          onSelectedIdChange={setSelectedId}
          visaKinds={visaKinds}
          currentListingId={listingId}
          onVisaKindSelect={onVisaKindSelect}
        />
      </MotionReveal>

      <div id="pricing" className="scroll-mt-28 sm:scroll-mt-32">
        <Suspense fallback={null}>
          <PricingPanel
            compact
            countryCode={countryCode}
            listingId={listingId}
            listingSlug={listingSlug}
            isFree={isFree}
            visaFree={visaFree}
            officialPortalUrl={officialPortalUrl}
            withFreeInsurance={withFreeInsurance}
            priceOptions={priceOptions}
            headline={headline}
            visaKinds={visaKinds}
            currentListingId={listingId}
            selectedId={selected?.id}
            onSelectedIdChange={setSelectedId}
            applyPath={applyPath}
            onApplyPathChange={setApplyPath}
            onVisaKindSelect={onVisaKindSelect}
          />
        </Suspense>
      </div>
    </section>
  );
}
