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
import {
  isInfoOnlyFreeEntry,
  PROCESS_TYPE_OPTIONS,
} from '@/lib/visa/processTypes';

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
  processType?: string | null;
  isArrivalCard?: boolean;
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
  processType = null,
  isArrivalCard = false,
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

  const infoOnlyFreeEntry = isInfoOnlyFreeEntry({
    processType,
    priceOptions,
  });

  const processTypeDisplay =
    PROCESS_TYPE_OPTIONS.find((option) => option.value === processType)
      ?.label ||
    processTypeLabel?.trim() ||
    'Visa on Arrival';

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
              hidePricingDetails={infoOnlyFreeEntry}
              onVisaKindSelect={onVisaKindSelect}
            />
          </MotionReveal>
        </div>

        <div id="pricing" className="scroll-mt-28 sm:scroll-mt-32">
          {infoOnlyFreeEntry ? (
            <MotionReveal>
              <div className="sticky top-32 relative isolate overflow-hidden rounded-2xl border border-ash-divider bg-[#0b1220] shadow-elevated sm:rounded-[32px]">
                <div
                  className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full opacity-40 blur-3xl"
                  style={{
                    background:
                      'radial-gradient(circle, rgba(38,192,255,0.55), transparent 70%)',
                  }}
                  aria-hidden
                />
                <div
                  className="pointer-events-none absolute -bottom-24 -left-10 h-64 w-64 rounded-full opacity-35 blur-3xl"
                  style={{
                    background:
                      'radial-gradient(circle, rgba(230,0,194,0.4), transparent 70%)',
                  }}
                  aria-hidden
                />
                <div className="relative flex min-h-[220px] flex-col justify-end p-6 sm:min-h-[280px] sm:p-9">
                  <p className="font-basier text-[2.75rem] leading-[0.95] tracking-[-0.05em] text-white sm:text-6xl sm:tracking-[-0.06em]">
                    {processTypeDisplay}
                  </p>
                  <div
                    className="mt-6 h-1 w-20 rounded-full sm:mt-8"
                    style={{
                      background:
                        'linear-gradient(90deg, rgb(38,192,255), rgb(230,0,194) 40%, rgb(255,161,62))',
                    }}
                    aria-hidden
                  />
                </div>
              </div>
            </MotionReveal>
          ) : (
            <Suspense fallback={null}>
              <PricingPanel
                compact
                countryCode={countryCode}
                listingId={listingId}
                listingSlug={listingSlug}
                isFree={isFree}
                visaFree={visaFree}
                isArrivalCard={isArrivalCard}
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
          )}
        </div>
      </div>
    </section>
  );
}
