'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ChevronDown, UserRound } from 'lucide-react';
import { Dropdown } from '@/components/ui/Dropdown';
import { cn } from '@/lib/utils';
import { trackEvent } from '@/lib/analytics/gtm';
import { passportPriceLabel } from '@/lib/passport/constants';

const CONSULTATION_URL =
  'https://wa.me/917676231760?text=' +
  encodeURIComponent(
    'Hi Viserv — I would like a free consultation for an Indian passport application.'
  );

export type PassportHeroPriceOption = {
  id: string;
  scheme: 'normal' | 'tatkaal';
  bookletPages: '36' | '60';
  governmentFeeAmount: number;
  serviceFeeAmount: number;
  governmentGstFeeAmount: number;
};

export type PassportHeroListing = {
  id: string;
  serviceType: 'fresh' | 'reissue';
  name: string;
  prices: PassportHeroPriceOption[];
};

type ApplyingForId = 'fresh' | 'reissue';

function IndiaFlagIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 16"
      className={className}
      aria-hidden
      focusable="false"
    >
      <rect width="24" height="16" rx="2" fill="#FF9933" />
      <rect y="5.33" width="24" height="5.34" fill="#FFFFFF" />
      <rect y="10.67" width="24" height="5.33" fill="#138808" />
      <circle
        cx="12"
        cy="8"
        r="2.1"
        fill="none"
        stroke="#000080"
        strokeWidth="0.9"
      />
      <circle cx="12" cy="8" r="0.45" fill="#000080" />
    </svg>
  );
}

function formatInr(amount: number, { spaced = false }: { spaced?: boolean } = {}) {
  const rounded = Math.round(amount);
  const grouped = String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return spaced ? `₹ ${grouped}` : `₹${grouped}`;
}

function RowSelect<T extends string>({
  icon,
  label,
  valueLabel,
  options,
  value,
  onChange,
  ariaLabel,
}: {
  icon: ReactNode;
  label: string;
  valueLabel: string;
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  ariaLabel: string;
}) {
  return (
    <Dropdown
      align="right"
      className="block w-full min-w-0"
      aria-label={ariaLabel}
      triggerClassName="flex w-full min-w-0 items-center justify-between gap-2 rounded-none px-3.5 py-3.5 text-left hover:bg-[#f8fafc] sm:gap-3 sm:px-4"
      panelClassName="mt-1.5 w-[min(100%,16rem)] min-w-[12rem] overflow-hidden rounded-2xl border border-ash-divider bg-white p-1 shadow-[0_16px_40px_rgba(8,48,76,0.14)]"
      trigger={({ open }) => (
        <>
          <span className="flex min-w-0 items-center gap-2 sm:gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f4f8ff] text-portrait-ink">
              {icon}
            </span>
            <span className="truncate text-sm text-slate-helper">{label}</span>
          </span>
          <span className="inline-flex min-w-0 max-w-[55%] items-center gap-1.5 text-sm font-semibold text-portrait-ink">
            <span className="truncate">{valueLabel}</span>
            <ChevronDown
              className={cn(
                'h-4 w-4 shrink-0 text-slate-helper transition-transform',
                open && 'rotate-180'
              )}
              aria-hidden
            />
          </span>
        </>
      )}
    >
      {({ close }) => (
        <ul role="listbox" aria-label={ariaLabel} className="py-0.5">
          {options.map((option) => {
            const selected = option.id === value;
            return (
              <li key={option.id} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(option.id);
                    close();
                  }}
                  className={cn(
                    'flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors',
                    selected
                      ? 'bg-[#2563EB] text-white'
                      : 'text-portrait-ink hover:bg-sky-wash/70'
                  )}
                >
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Dropdown>
  );
}

export function PassportHeroPricingCard({
  listings,
  className,
}: {
  listings: PassportHeroListing[];
  className?: string;
}) {
  const applyingOptions = useMemo(
    () =>
      listings.map((listing) => ({
        id: listing.serviceType as ApplyingForId,
        label:
          listing.serviceType === 'fresh' ? 'Fresh passport' : 'Re-issue',
      })),
    [listings]
  );

  const [applyingFor, setApplyingFor] = useState<ApplyingForId>(
    applyingOptions.find((o) => o.id === 'reissue')?.id ||
      applyingOptions[0]?.id ||
      'reissue'
  );

  const activeListing =
    listings.find((l) => l.serviceType === applyingFor) || listings[0];

  const typeOptions = useMemo(
    () =>
      (activeListing?.prices ?? []).map((price) => ({
        id: price.id,
        label: passportPriceLabel(price.scheme, price.bookletPages),
        governmentFee: price.governmentFeeAmount,
        serviceFee: price.serviceFeeAmount,
        gstFee: price.governmentGstFeeAmount,
      })),
    [activeListing]
  );

  const [passportTypeId, setPassportTypeId] = useState(
    typeOptions[0]?.id || ''
  );

  const selectedType =
    typeOptions.find((option) => option.id === passportTypeId) ||
    typeOptions[0];

  // When switching Fresh/Re-issue, keep matching scheme+pages if possible
  const onApplyingChange = (next: ApplyingForId) => {
    setApplyingFor(next);
    const nextListing = listings.find((l) => l.serviceType === next);
    const current = selectedType;
    if (!nextListing || !current) {
      setPassportTypeId(nextListing?.prices[0]?.id || '');
      return;
    }
    const match = nextListing.prices.find((p) => {
      const label = passportPriceLabel(p.scheme, p.bookletPages);
      return label === current.label;
    });
    setPassportTypeId(match?.id || nextListing.prices[0]?.id || '');
  };

  const governmentFee = selectedType?.governmentFee ?? 0;
  const serviceFee = selectedType?.serviceFee ?? 0;
  const gstFee = selectedType?.gstFee ?? 0;
  const total = governmentFee + serviceFee + gstFee;
  const applyingLabel =
    applyingOptions.find((option) => option.id === applyingFor)?.label ||
    'Re-issue';

  const applyHref = passportTypeId
    ? `/passport/${applyingFor}/apply?priceOption=${encodeURIComponent(passportTypeId)}`
    : `/passport/${applyingFor}/apply`;

  const onStartApplicationClick = () => {
    trackEvent('passport_apply_start_click', {
      service_type: applyingFor,
      listing_id: activeListing?.id,
      price_option_id: passportTypeId || undefined,
      value: total > 0 ? total : undefined,
      currency: 'INR',
    });
  };

  if (!activeListing || typeOptions.length === 0) {
    return (
      <div
        className={cn(
          'w-full max-w-[22.5rem] rounded-[32px] border-[3px] border-portrait-ink bg-white p-6',
          className
        )}
      >
        <p className="text-sm text-slate-helper">
          Pricing will appear once passport packages are configured.
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'w-full max-w-[22.5rem] rounded-[32px] border-[3px] border-portrait-ink bg-white p-5 shadow-[0_22px_50px_rgba(8,48,76,0.22)] sm:max-w-[24rem] sm:rounded-[36px] sm:p-6',
        className
      )}
    >
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="font-basier text-[2rem] leading-none tracking-[-0.03em] text-portrait-ink sm:text-[2.15rem]">
          {formatInr(total, { spaced: true })}
        </span>
        <span className="text-sm text-slate-helper">/per traveler</span>
      </p>

      <div className="relative mt-5 overflow-visible rounded-[22px] border border-ash-divider bg-white">
        <RowSelect
          ariaLabel="Applying for"
          icon={<UserRound className="h-4 w-4" aria-hidden />}
          label="Applying for"
          value={applyingFor}
          valueLabel={applyingLabel}
          options={applyingOptions}
          onChange={onApplyingChange}
        />
        <div className="mx-3.5 border-t border-ash-divider sm:mx-4" />
        <RowSelect
          ariaLabel="Passport type"
          icon={<IndiaFlagIcon className="h-3.5 w-5" />}
          label="Passport Type"
          value={(passportTypeId || typeOptions[0].id) as string}
          valueLabel={selectedType?.label || typeOptions[0].label}
          options={typeOptions.map((o) => ({ id: o.id, label: o.label }))}
          onChange={setPassportTypeId}
        />
      </div>

      <div className="mt-5 space-y-2.5 text-sm">
        <div className="flex items-center justify-between gap-3 text-slate-helper">
          <span>Government fees</span>
          <span className="tabular-nums text-portrait-ink">
            {formatInr(governmentFee)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 text-slate-helper">
          <span>Viserv service fees</span>
          <span className="tabular-nums text-portrait-ink">
            {formatInr(serviceFee)}
          </span>
        </div>
        {gstFee > 0 && (
          <div className="flex items-center justify-between gap-3 text-slate-helper">
            <span>GST</span>
            <span className="tabular-nums text-portrait-ink">
              {formatInr(gstFee)}
            </span>
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-col gap-2.5">
        <Link
          href={applyHref}
          onClick={onStartApplicationClick}
          className="inline-flex w-full items-center justify-center rounded-full bg-[#2563EB] px-5 py-3.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(37,99,235,0.28)] transition-colors hover:bg-[#1749B5] active:scale-[0.99]"
        >
          Start Application
        </Link>
        <a
          href={CONSULTATION_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-full items-center justify-center rounded-full border border-[#2563EB] bg-white px-5 py-3.5 text-sm font-semibold text-[#2563EB] transition-colors hover:bg-[#eff6ff] active:scale-[0.99]"
        >
          Get a free consultation
        </a>
      </div>
    </div>
  );
}
