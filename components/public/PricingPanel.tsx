'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ExternalLink, Minus, Plus, Users } from 'lucide-react';
import { AnimatedStatValue, AnimatedTabs, Badge, Button } from '@/components/ui';
import { beginVisaKindNavigation } from '@/components/public/PreserveListingView';
import { useApplyStartFlow } from '@/components/apply/useApplyStartFlow';
import { formatPrice } from '@/lib/public';
import { readApplyDraft } from '@/lib/apply/draftStorage';

const INR = 'INR';
const MIN_TRAVELLERS = 1;
const MAX_TRAVELLERS = 100;

export type ApplyPath = 'portal' | 'viserv';

const APPLY_PATH_TABS = [
  { id: 'portal' as const, label: 'Visa portal' },
  { id: 'viserv' as const, label: 'Apply with Viserv' },
];

function safeHttpUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Government visa fee is ₹0; Viserv still charges a service fee. */
export function isFreeVisaWithServiceFee(option: PriceOptionView | undefined) {
  if (!option) return false;
  return option.governmentFeeAmount === 0 && option.serviceFeeAmount > 0;
}

/** All fees are ₹0 — DIY portal only (no How to apply tabs). */
export function isFullyFreeVisa(option: PriceOptionView | undefined) {
  if (!option) return false;
  return (
    option.governmentFeeAmount === 0 &&
    option.serviceFeeAmount === 0 &&
    option.governmentGstFeeAmount === 0
  );
}

export interface PriceOptionView {
  id: string;
  daysLabel: string | null;
  formattedTotal: string;
  formattedLabel: string;
  governmentFeeAmount: number;
  serviceFeeAmount: number;
  governmentGstFeeAmount: number;
  governmentFeeLabel?: string;
  serviceFeeLabel?: string;
  governmentGstFeeLabel?: string;
  entryValidity?: string | null;
  stayDuration?: string | null;
}

export interface VisaKindOption {
  id: string;
  label: string;
  href: string;
  purpose: string;
}

interface PricingPanelProps {
  isFree: boolean;
  /** Listing marked visa-free (government entry product has no fee). */
  visaFree?: boolean;
  /** Official government / visa portal URL for DIY apply. */
  officialPortalUrl?: string | null;
  withFreeInsurance?: boolean;
  countryCode: string;
  listingId: string;
  compact?: boolean;
  priceOptions: PriceOptionView[];
  headline?: string;
  /** Sibling visa listings for this country. Shown only when length > 1. */
  visaKinds?: VisaKindOption[];
  currentListingId?: string;
  selectedId?: string;
  onSelectedIdChange?: (id: string) => void;
  applyPath?: ApplyPath;
  onApplyPathChange?: (path: ApplyPath) => void;
  onVisaKindSelect?: (kind: VisaKindOption) => Promise<boolean> | boolean;
}

function stayDaysLabel(option: PriceOptionView) {
  return option.stayDuration || option.daysLabel || option.entryValidity || 'Package';
}

function VisaKindSelector({
  visaKinds,
  currentListingId,
  tone = 'dark',
  onSelect,
}: {
  visaKinds: VisaKindOption[];
  currentListingId?: string;
  tone?: 'dark' | 'light';
  onSelect?: (kind: VisaKindOption) => Promise<boolean> | boolean;
}) {
  const router = useRouter();
  const current =
    visaKinds.find((kind) => kind.id === currentListingId) || visaKinds[0];
  const [pendingId, setPendingId] = useState(current?.id);
  const switchingRef = useRef(false);

  useEffect(() => {
    setPendingId(current?.id);
  }, [current?.id]);

  useEffect(() => {
    visaKinds.forEach((kind) => {
      if (kind.id !== current?.id) router.prefetch(kind.href);
    });
  }, [visaKinds, current?.id, router]);

  if (!current || visaKinds.length < 2) return null;

  const isDark = tone === 'dark';

  return (
    <div>
      <p
        className={`mb-2 text-[10px] uppercase tracking-[0.2em] sm:text-xs ${
          isDark ? 'text-white/50' : 'text-slate-helper'
        }`}
      >
        Visa type
      </p>
      <AnimatedTabs
        items={visaKinds.map((kind) => ({ id: kind.id, label: kind.label }))}
        value={pendingId || current.id}
        onChange={(id) => {
          const kind = visaKinds.find((item) => item.id === id);
          if (!kind || kind.id === current.id || switchingRef.current) return;

          const previousId = current.id;
          setPendingId(id);

          const navigate = async () => {
            switchingRef.current = true;
            try {
              if (onSelect) {
                const ok = await onSelect(kind);
                if (!ok) setPendingId(previousId);
                return;
              }

              beginVisaKindNavigation();
              router.push(kind.href, { scroll: false });
            } finally {
              switchingRef.current = false;
            }
          };

          void navigate();
        }}
        tone={tone}
        ariaLabel="Visa type"
        layoutId="visa-kind-tabs"
      />
    </div>
  );
}

function TravellersCounter({
  count,
  onChange,
  tone = 'dark',
}: {
  count: number;
  onChange: (next: number) => void;
  tone?: 'dark' | 'light';
}) {
  const isDark = tone === 'dark';
  const canDecrease = count > MIN_TRAVELLERS;
  const canIncrease = count < MAX_TRAVELLERS;

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-xl px-3.5 py-3 sm:rounded-[20px] sm:px-4 ${
        isDark
          ? 'border border-white/15 bg-white/10'
          : 'border border-ash-divider bg-[#f8fafc]'
      }`}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <Users
          className={`h-4 w-4 shrink-0 ${
            isDark ? 'text-white/80' : 'text-portrait-ink'
          }`}
          aria-hidden
        />
        <span
          className={`text-sm font-medium ${
            isDark ? 'text-white' : 'text-portrait-ink'
          }`}
        >
          Travellers
        </span>
      </div>

      <div
        className="flex items-center gap-1"
        role="group"
        aria-label="Traveller count"
      >
        <button
          type="button"
          aria-label="Decrease travellers"
          disabled={!canDecrease}
          onClick={() => onChange(count - 1)}
          className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
            isDark
              ? canDecrease
                ? 'bg-white/12 text-white hover:bg-white/18'
                : 'bg-white/6 text-white/30'
              : canDecrease
                ? 'bg-white text-portrait-ink hover:bg-sky-wash'
                : 'bg-white/60 text-slate-helper/40'
          } disabled:cursor-not-allowed`}
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span
          className={`min-w-[1.75rem] text-center text-sm font-semibold tabular-nums ${
            isDark ? 'text-white' : 'text-portrait-ink'
          }`}
          aria-live="polite"
        >
          {count}
        </span>
        <button
          type="button"
          aria-label="Increase travellers"
          disabled={!canIncrease}
          onClick={() => onChange(count + 1)}
          className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
            isDark
              ? canIncrease
                ? 'bg-white/12 text-white hover:bg-white/18'
                : 'bg-white/6 text-white/30'
              : canIncrease
                ? 'bg-white text-portrait-ink hover:bg-sky-wash'
                : 'bg-white/60 text-slate-helper/40'
          } disabled:cursor-not-allowed`}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function PricingPanel({
  isFree,
  visaFree = false,
  officialPortalUrl = null,
  withFreeInsurance = false,
  countryCode,
  listingId,
  compact: _compact = false,
  priceOptions,
  headline,
  visaKinds = [],
  currentListingId,
  selectedId: selectedIdProp,
  onSelectedIdChange,
  applyPath: applyPathProp,
  onApplyPathChange,
  onVisaKindSelect,
}: PricingPanelProps) {
  const stayTabsId = useId();
  const applyPathTabsId = useId();
  const [internalSelectedId, setInternalSelectedId] = useState(priceOptions[0]?.id);
  const [travellers, setTravellers] = useState(MIN_TRAVELLERS);
  const [internalApplyPath, setInternalApplyPath] = useState<ApplyPath>('portal');
  const selectedId = selectedIdProp ?? internalSelectedId;
  const applyPath = applyPathProp ?? internalApplyPath;
  const selected =
    priceOptions.find((option) => option.id === selectedId) || priceOptions[0];
  const portalUrl = safeHttpUrl(officialPortalUrl);
  const freeWithServiceFee = isFreeVisaWithServiceFee(selected);
  const portalOnlyFree = isFullyFreeVisa(selected) || (isFree && !freeWithServiceFee);
  const darkCta =
    'w-full border-white bg-white text-portrait-ink hover:bg-white/90 hover:text-portrait-ink group flex items-center justify-center';

  const setSelectedId = (id: string) => {
    if (selectedIdProp === undefined) setInternalSelectedId(id);
    onSelectedIdChange?.(id);
  };

  const setApplyPath = (path: ApplyPath) => {
    if (applyPathProp === undefined) setInternalApplyPath(path);
    onApplyPathChange?.(path);
  };

  const { requestStart, modals } = useApplyStartFlow({
    countryCode,
    listingId,
    travellers,
    priceOptionId: selected?.id,
  });

  const scaleAmount = (amount: number) => amount * travellers;

  const scaledTotal = selected
    ? scaleAmount(
        selected.governmentFeeAmount +
          selected.serviceFeeAmount +
          selected.governmentGstFeeAmount
      )
    : 0;

  const displayHeadline = selected
    ? selected.daysLabel
      ? `${formatPrice(scaledTotal, INR)} · ${selected.daysLabel}`
      : formatPrice(scaledTotal, INR)
    : headline || 'FREE';

  const applyHref = `/visa/${countryCode.toLowerCase()}/${listingId}/apply?travellers=${Math.min(100, Math.max(1, travellers))}${
    selected?.id ? `&priceOption=${selected.id}` : ''
  }`;

  const startButton = (className?: string) => (
    <Button
      type="button"
        onClick={() => {
          if (readApplyDraft(listingId)) {
            requestStart();
            return;
          }
          window.location.assign(applyHref);
        }}
      className={
        className ||
        'w-full group flex items-center justify-center'
      }
      size="lg"
    >
      Start application
      <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
    </Button>
  );

  const portalButton = (className?: string) => (
    <Button
      type="button"
      disabled={!portalUrl}
      onClick={() => {
        if (!portalUrl) return;
        window.open(portalUrl, '_blank', 'noopener,noreferrer');
      }}
      className={
        className ||
        'w-full group inline-flex items-center justify-center'
      }
      size="lg"
    >
      {portalUrl ? 'Open visa portal' : 'Portal link unavailable'}
      {portalUrl ? (
        <ExternalLink className="ml-2 h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
      ) : null}
    </Button>
  );

  const portalPathContent = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/50 sm:text-xs">
            Official portal
          </p>
          <h3 className="mt-2 font-basier text-2xl text-white sm:mt-3 sm:text-3xl">
            Free on the visa portal
          </h3>
          <p className="mt-1 text-xs text-white/65 sm:text-sm">
            Visa fee is ₹0. Apply yourself on the official site.
          </p>
        </div>
        <Badge className="shrink-0 border-0 bg-mint-wash text-portrait-ink text-[10px] sm:text-xs">
          {visaFree ? 'Visa free · DIY' : 'DIY · Free'}
        </Badge>
      </div>

      <div className="mt-5 space-y-3 rounded-xl bg-white/8 p-4 sm:mt-6 sm:space-y-4 sm:rounded-[24px] sm:p-5">
        <div className="flex items-center justify-between text-xs text-white/72 sm:text-sm">
          <span>Visa fee</span>
          <span>FREE</span>
        </div>
        <div className="flex items-center justify-between text-xs text-white/72 sm:text-sm">
          <span>Viserv service fee</span>
          <span>Not charged</span>
        </div>
        {withFreeInsurance && (
          <div className="flex items-center justify-between text-xs text-white/72 sm:text-sm">
            <span>Insurance</span>
            <span>Free</span>
          </div>
        )}
        <p className="text-xs leading-5 text-white/55 sm:text-sm sm:leading-6">
          You fill and submit the form on the official visa portal. Viserv does
          not process this path or charge a fee.
        </p>
      </div>

      <div className="mt-5 sm:mt-6">{portalButton(darkCta)}</div>
    </>
  );

  const typeAndTravellers = (tone: 'dark' | 'light') => (
    <div className="mb-5 space-y-3 sm:mb-6 sm:space-y-4">
      {visaKinds.length > 1 && (
        <VisaKindSelector
          visaKinds={visaKinds}
          currentListingId={currentListingId}
          tone={tone}
          onSelect={onVisaKindSelect}
        />
      )}
      <TravellersCounter
        count={travellers}
        onChange={setTravellers}
        tone={tone}
      />
      {priceOptions.length > 1 && selected && (
        <div>
          <p
            className={`mb-2 text-[10px] uppercase tracking-[0.2em] sm:text-xs ${
              tone === 'dark' ? 'text-white/50' : 'text-slate-helper'
            }`}
          >
            Stay
          </p>
          <AnimatedTabs
            items={priceOptions.map((option) => ({
              id: option.id,
              label: stayDaysLabel(option),
            }))}
            value={selected.id}
            onChange={setSelectedId}
            tone={tone}
            ariaLabel="Stay duration"
            layoutId={`stay-days${stayTabsId}`}
          />
        </div>
      )}
      {freeWithServiceFee && (
        <div>
          <p
            className={`mb-2 text-[10px] uppercase tracking-[0.2em] sm:text-xs ${
              tone === 'dark' ? 'text-white/50' : 'text-slate-helper'
            }`}
          >
            How to apply
          </p>
          <AnimatedTabs
            items={APPLY_PATH_TABS}
            value={applyPath}
            onChange={(id) => setApplyPath(id as ApplyPath)}
            tone={tone}
            ariaLabel="How to apply"
            layoutId={`apply-path${applyPathTabsId}`}
          />
        </div>
      )}
    </div>
  );

  // Fully free (visa + service + GST): portal UI only, no How to apply tabs
  if (portalOnlyFree) {
    return (
      <>
        <div className="sticky top-32 rounded-2xl border border-ash-divider bg-[#0b1220] p-5 text-white shadow-elevated sm:rounded-[32px] sm:p-7">
          {typeAndTravellers('dark')}
          {portalPathContent}
        </div>
        {modals}
      </>
    );
  }

  if (!selected) {
    return (
      <>
        <div className="sticky top-32 rounded-2xl border border-ash-divider bg-[#0b1220] p-5 text-white shadow-elevated sm:rounded-[32px] sm:p-7">
          {typeAndTravellers('dark')}
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/50 sm:text-xs">
            Pricing
          </p>
          <h3 className="mt-2 font-basier text-2xl text-white sm:mt-3 sm:text-3xl">
            Pricing on request
          </h3>
          <p className="mt-1 text-xs text-white/65 sm:text-sm">
            Packages will appear once price options are configured.
          </p>
          <div className="mt-5 hidden sm:mt-6 sm:block">
            {startButton(darkCta)}
          </div>
        </div>
        {modals}
      </>
    );
  }

  // Free visa + Viserv service fee: portal DIY vs assisted apply tabs
  if (freeWithServiceFee) {
    return (
      <>
        <div className="sticky top-32 rounded-2xl border border-ash-divider bg-[#0b1220] p-5 text-white shadow-elevated sm:rounded-[32px] sm:p-7">
          {typeAndTravellers('dark')}

          {applyPath === 'portal' ? (
            portalPathContent
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/50 sm:text-xs">
                    Our charges
                  </p>
                  <h3 className="mt-2 font-basier text-2xl text-white sm:mt-3 sm:text-3xl">
                    <AnimatedStatValue value={displayHeadline} />
                  </h3>
                  <p className="mt-1 text-xs text-white/65 sm:text-sm">
                    <AnimatedStatValue
                      value={`We fill and process your application${
                        travellers > 1 ? ` · ${travellers} travellers` : ''
                      }`}
                    />
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <Badge className="border-0 bg-white text-portrait-ink text-[10px] sm:text-xs">
                    Handled by Viserv
                  </Badge>
                  {withFreeInsurance && (
                    <Badge className="border-0 bg-mint-wash text-portrait-ink text-[10px] sm:text-xs">
                      Free Insurance
                    </Badge>
                  )}
                </div>
              </div>

              <div className="mt-5 space-y-3 rounded-xl bg-white/8 p-4 sm:mt-6 sm:space-y-4 sm:rounded-[24px] sm:p-5">
                <div className="flex items-center justify-between text-xs text-white/72 sm:text-sm">
                  <span>Visa fee</span>
                  <span>FREE</span>
                </div>
                <div className="flex items-center justify-between text-xs text-white/72 sm:text-sm">
                  <span>Service fee</span>
                  <span>
                    <AnimatedStatValue
                      value={formatPrice(
                        scaleAmount(selected.serviceFeeAmount),
                        INR
                      )}
                    />
                  </span>
                </div>
                {selected.governmentGstFeeAmount > 0 && (
                  <div className="flex items-center justify-between text-xs text-white/72 sm:text-sm">
                    <span>Government GST</span>
                    <span>
                      <AnimatedStatValue
                        value={formatPrice(
                          scaleAmount(selected.governmentGstFeeAmount),
                          INR
                        )}
                      />
                    </span>
                  </div>
                )}
                <p className="text-xs leading-5 text-white/55 sm:text-sm sm:leading-6">
                  Visa itself is free. You pay Viserv to complete the form, check
                  documents, and process the application for you.
                </p>
              </div>

              <div className="mt-5 hidden sm:mt-6 sm:block">
                {startButton(darkCta)}
              </div>
            </>
          )}
        </div>
        {modals}
      </>
    );
  }

  return (
    <>
      <div className="sticky top-32 rounded-2xl border border-ash-divider bg-[#0b1220] p-5 text-white shadow-elevated sm:rounded-[32px] sm:p-7">
        {typeAndTravellers('dark')}

        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/50 sm:text-xs">
              Pricing
            </p>
            <h3 className="mt-2 font-basier text-2xl text-white sm:mt-3 sm:text-3xl">
              <AnimatedStatValue value={displayHeadline} />
            </h3>
            <p className="mt-1 text-xs text-white/65 sm:text-sm">
              <AnimatedStatValue
                value={`${
                  selected.daysLabel
                    ? `Package: ${selected.daysLabel}`
                    : 'Choose a validity and stay package'
                }${travellers > 1 ? ` · ${travellers} travellers` : ''}`}
              />
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <Badge className="border-0 bg-white text-portrait-ink text-[10px] sm:text-xs">
              Transparent fees
            </Badge>
            {withFreeInsurance && (
              <Badge className="border-0 bg-mint-wash text-portrait-ink text-[10px] sm:text-xs">
                Free Insurance
              </Badge>
            )}
          </div>
        </div>

        <div className="mt-5 space-y-3 rounded-xl bg-white/8 p-4 sm:mt-6 sm:space-y-4 sm:rounded-[24px] sm:p-5">
          <div className="flex items-center justify-between text-xs text-white/72 sm:text-sm">
            <span>Visa fee</span>
            <span>
              <AnimatedStatValue
                value={formatPrice(scaleAmount(selected.governmentFeeAmount), INR)}
              />
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-white/72 sm:text-sm">
            <span>Service fee</span>
            <span>
              <AnimatedStatValue
                value={formatPrice(scaleAmount(selected.serviceFeeAmount), INR)}
              />
            </span>
          </div>
          {selected.governmentGstFeeAmount > 0 && <div className="flex items-center justify-between text-xs text-white/72 sm:text-sm">
            <span>Government GST</span>
            <span>
              <AnimatedStatValue
                value={formatPrice(scaleAmount(selected.governmentGstFeeAmount), INR)}
              />
            </span>
          </div>}
        </div>

        <div className="mt-5 hidden sm:mt-6 sm:block">
          {startButton(
            'w-full border-white bg-white text-portrait-ink hover:bg-white/90 hover:text-portrait-ink group flex items-center justify-center'
          )}
        </div>
      </div>
      {modals}
    </>
  );
}
