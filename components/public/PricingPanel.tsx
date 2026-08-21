'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, ChevronDown, Minus, Plus, Users } from 'lucide-react';
import { Badge, Button } from '@/components/ui';
import { MotionReveal } from '@/components/public/MotionReveal';
import { useApplyStartFlow } from '@/components/apply/useApplyStartFlow';
import { formatPrice } from '@/lib/public';

const INR = 'INR';
const MIN_TRAVELLERS = 1;
const MAX_TRAVELLERS = 100;

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
  countryCode: string;
  listingId: string;
  compact?: boolean;
  priceOptions: PriceOptionView[];
  headline?: string;
  /** Sibling visa listings for this country. Shown only when length > 1. */
  visaKinds?: VisaKindOption[];
  currentListingId?: string;
}

function VisaKindSelector({
  visaKinds,
  currentListingId,
  tone = 'dark',
}: {
  visaKinds: VisaKindOption[];
  currentListingId?: string;
  tone?: 'dark' | 'light';
}) {
  const router = useRouter();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const current =
    visaKinds.find((kind) => kind.id === currentListingId) || visaKinds[0];

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (!current || visaKinds.length < 2) return null;

  const isDark = tone === 'dark';

  return (
    <div ref={rootRef} className="relative">
      <p
        className={`mb-2 text-[10px] uppercase tracking-[0.2em] sm:text-xs ${
          isDark ? 'text-white/50' : 'text-slate-helper'
        }`}
      >
        Visa type
      </p>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((value) => !value)}
        className={`flex w-full items-center justify-between gap-3 rounded-xl px-3.5 py-3 text-left transition-colors sm:rounded-[20px] sm:px-4 ${
          isDark
            ? 'border border-white/15 bg-white/10 hover:bg-white/14'
            : 'border border-ash-divider bg-[#f8fafc] hover:bg-sky-wash/60'
        }`}
      >
        <span
          className={`text-sm font-medium ${
            isDark ? 'text-white' : 'text-portrait-ink'
          }`}
        >
          {current.label}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          } ${isDark ? 'text-white/70' : 'text-slate-helper'}`}
        />
      </button>

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Available visa types"
          className={`absolute left-0 right-0 z-20 mt-2 overflow-hidden rounded-xl border py-1 shadow-elevated sm:rounded-[20px] ${
            isDark
              ? 'border-white/15 bg-[#121a2b]'
              : 'border-ash-divider bg-white'
          }`}
        >
          {visaKinds.map((kind) => {
            const isActive = kind.id === current.id;
            return (
              <li key={kind.id} role="option" aria-selected={isActive}>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    if (kind.id !== current.id) {
                      router.push(kind.href);
                    }
                  }}
                  className={`flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-sm transition-colors sm:px-4 sm:py-3 ${
                    isDark
                      ? isActive
                        ? 'bg-white/12 text-white'
                        : 'text-white/80 hover:bg-white/8 hover:text-white'
                      : isActive
                        ? 'bg-sky-wash text-portrait-ink'
                        : 'text-portrait-ink hover:bg-[#f8fafc]'
                  }`}
                >
                  <span>{kind.label}</span>
                  {isActive && (
                    <Check
                      className={`h-4 w-4 shrink-0 ${
                        isDark ? 'text-white' : 'text-portrait-ink'
                      }`}
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
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
  countryCode,
  listingId,
  compact = false,
  priceOptions,
  headline,
  visaKinds = [],
  currentListingId,
}: PricingPanelProps) {
  const [selectedId, setSelectedId] = useState(priceOptions[0]?.id);
  const [travellers, setTravellers] = useState(MIN_TRAVELLERS);
  const selected =
    priceOptions.find((option) => option.id === selectedId) || priceOptions[0];

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

  const startButton = (className?: string) => (
    <Button
      type="button"
      onClick={requestStart}
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

  const typeAndTravellers = (tone: 'dark' | 'light') => (
    <div className="mb-5 space-y-3 sm:mb-6 sm:space-y-4">
      {visaKinds.length > 1 && (
        <VisaKindSelector
          visaKinds={visaKinds}
          currentListingId={currentListingId}
          tone={tone}
        />
      )}
      <TravellersCounter
        count={travellers}
        onChange={setTravellers}
        tone={tone}
      />
    </div>
  );

  if (isFree) {
    return (
      <MotionReveal>
        <div className="rounded-2xl border border-mint-wash bg-white p-5 shadow-elevated sm:rounded-[32px] sm:p-7">
          {typeAndTravellers('light')}
          <Badge className="border-0 bg-mint-wash text-portrait-ink">100% free</Badge>
          <h3 className="mt-4 font-basier text-2xl text-portrait-ink sm:mt-5 sm:text-3xl">
            No payment needed.
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-helper sm:mt-3">
            Complete this entry product online without a platform fee. Documents
            and timeline stay visible before you submit.
          </p>
          <div className="mt-5 hidden sm:mt-6 sm:block">
            {startButton()}
          </div>
        </div>
        {modals}
      </MotionReveal>
    );
  }

  if (!selected) {
    return (
      <MotionReveal>
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
            {startButton(
              'w-full border-white bg-white text-portrait-ink hover:bg-white/90 hover:text-portrait-ink group flex items-center justify-center'
            )}
          </div>
        </div>
        {modals}
      </MotionReveal>
    );
  }

  return (
    <MotionReveal>
      <div className="sticky top-32 rounded-2xl border border-ash-divider bg-[#0b1220] p-5 text-white shadow-elevated sm:rounded-[32px] sm:p-7">
        {typeAndTravellers('dark')}

        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/50 sm:text-xs">
              Pricing
            </p>
            <h3 className="mt-2 font-basier text-2xl text-white sm:mt-3 sm:text-3xl">
              {displayHeadline}
            </h3>
            <p className="mt-1 text-xs text-white/65 sm:text-sm">
              {selected.daysLabel
                ? `Package: ${selected.daysLabel}`
                : 'Choose a validity and stay package'}
              {travellers > 1 ? ` · ${travellers} travellers` : ''}
            </p>
          </div>
          <Badge className="border-0 bg-white text-portrait-ink text-[10px] sm:text-xs">
            Transparent fees
          </Badge>
        </div>

        {!compact && priceOptions.length > 1 && (
          <div className="mt-5 grid gap-2 sm:mt-6 sm:gap-3">
            {priceOptions.map((option) => {
              const isActive = option.id === selected.id;
              const optionTotal = scaleAmount(
                option.governmentFeeAmount +
                  option.serviceFeeAmount +
                  option.governmentGstFeeAmount
              );
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSelectedId(option.id)}
                  className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-left transition-colors sm:rounded-[20px] sm:px-4 sm:py-3 ${
                    isActive ? 'bg-white/16 ring-1 ring-white/30' : 'bg-white/8 hover:bg-white/12'
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium text-white">
                      {option.stayDuration || option.entryValidity || 'Package'}
                    </p>
                    <p className="text-xs text-white/55">
                      {option.entryValidity
                        ? `${option.entryValidity} validity`
                        : 'Validity on request'}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-white">
                    {formatPrice(optionTotal, INR)}
                  </p>
                </button>
              );
            })}
          </div>
        )}

        {compact && priceOptions.length > 1 && (
          <div className="mt-5 space-y-2 sm:mt-6">
            {priceOptions.map((option) => {
              const isActive = option.id === selected.id;
              const optionTotal = scaleAmount(
                option.governmentFeeAmount +
                  option.serviceFeeAmount +
                  option.governmentGstFeeAmount
              );
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSelectedId(option.id)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition-colors sm:rounded-[20px] sm:px-4 sm:py-3 ${
                    isActive ? 'bg-white/16 ring-1 ring-white/30' : 'bg-white/8 hover:bg-white/12'
                  }`}
                >
                  <p className="text-sm text-white/80">
                    {option.daysLabel || 'Package'}
                  </p>
                  <p className="text-sm font-semibold text-white">
                    {formatPrice(optionTotal, INR)}
                  </p>
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-5 space-y-3 rounded-xl bg-white/8 p-4 sm:mt-6 sm:space-y-4 sm:rounded-[24px] sm:p-5">
          <div className="flex items-center justify-between text-xs text-white/72 sm:text-sm">
            <span>Government fee</span>
            <span>
              {formatPrice(scaleAmount(selected.governmentFeeAmount), INR)}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-white/72 sm:text-sm">
            <span>Service fee</span>
            <span>
              {formatPrice(scaleAmount(selected.serviceFeeAmount), INR)}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-white/72 sm:text-sm">
            <span>Government GST</span>
            <span>
              {formatPrice(scaleAmount(selected.governmentGstFeeAmount), INR)}
            </span>
          </div>
        </div>

        <div className="mt-5 hidden sm:mt-6 sm:block">
          {startButton(
            'w-full border-white bg-white text-portrait-ink hover:bg-white/90 hover:text-portrait-ink group flex items-center justify-center'
          )}
        </div>
      </div>
      {modals}
    </MotionReveal>
  );
}
