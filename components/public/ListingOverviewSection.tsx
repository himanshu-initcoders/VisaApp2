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
import { sanitizeBlogHtml } from '@/lib/blog/sanitize';

const OVERVIEW_RICH_TEXT_CLASS =
  'max-w-3xl text-[15px] leading-7 text-portrait-ink sm:text-base sm:leading-8 [&_a]:text-nautical-teal [&_a]:underline [&_h2]:font-basier [&_h2]:text-2xl [&_h2]:mt-8 [&_h2]:mb-3 [&_h3]:font-basier [&_h3]:text-xl [&_h3]:mt-6 [&_h3]:mb-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mb-3 [&_strong]:font-semibold';

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
  processTypeLabel?: string | null;
  priceOptions: PriceOptionView[];
  headline?: string;
  isMultipleEntry?: boolean;
  visaKinds?: VisaKindOption[];
  hasRequiredDocuments?: boolean;
  onVisaKindSelect?: (kind: VisaKindOption) => Promise<boolean> | boolean;
}

export function ListingOverviewSection({
  overview,
  processingEta,
  isFree,
  visaFree = false,
  officialPortalUrl = null,
  withFreeInsurance = false,
  countryCode,
  countryName,
  listingId,
  listingSlug,
  processTypeLabel,
  priceOptions,
  headline,
  isMultipleEntry = false,
  visaKinds = [],
  hasRequiredDocuments = false,
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

  const overviewHtml = useMemo(() => {
    const raw = overview?.trim() || '';
    if (!raw) return '';
    return sanitizeBlogHtml(raw);
  }, [overview]);

  const hasOverview =
    overviewHtml.replace(/<[^>]*>/g, '').trim().length > 0 ||
    /<img\b/i.test(overviewHtml);

  const isLegacyPlainText =
    hasOverview && !/<[a-z][\s\S]*>/i.test(overview?.trim() || '');

  return (
    <section id="overview" className="scroll-mt-28 sm:scroll-mt-32">
      <div className="space-y-6 sm:space-y-0 lg:grid lg:grid-cols-[1fr_0.95fr] lg:gap-8">
        <div className="space-y-5 sm:space-y-6">
          {hasOverview ? (
            <MotionReveal>
              {isLegacyPlainText ? (
                <p className={`${OVERVIEW_RICH_TEXT_CLASS} whitespace-pre-line`}>
                  {overview.trim()}
                </p>
              ) : (
                <div
                  className={OVERVIEW_RICH_TEXT_CLASS}
                  dangerouslySetInnerHTML={{ __html: overviewHtml }}
                />
              )}
            </MotionReveal>
          ) : null}

          <MotionReveal>
            <VisaTypesOffered
              countryName={countryName}
              processingEta={processingEta}
              isMultipleEntry={isMultipleEntry}
              processTypeLabel={processTypeLabel}
              priceOptions={priceOptions}
              selectedId={selected?.id}
              onSelectedIdChange={setSelectedId}
              visaKinds={visaKinds}
              currentListingId={listingId}
              hasRequiredDocuments={hasRequiredDocuments}
              onVisaKindSelect={onVisaKindSelect}
            />
          </MotionReveal>
        </div>

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
      </div>
    </section>
  );
}
