'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  Briefcase,
  Check,
  ChevronDown,
  GraduationCap,
  HeartPulse,
  Plane,
  ArrowRightLeft,
  MapPin,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { beginVisaKindNavigation } from '@/components/public/PreserveListingView';
import type {
  PriceOptionView,
  VisaKindListingOption,
  VisaKindOption,
} from '@/components/public/PricingPanel';
import { visaPurposeTabLabel } from '@/lib/visa/purposes';
import { cn } from '@/lib/utils';

const VISIBLE_OPTIONS = 2;

const PURPOSE_ICONS: Record<string, LucideIcon> = {
  tourism: Plane,
  business: Briefcase,
  work: Briefcase,
  study: GraduationCap,
  family: Users,
  medical: HeartPulse,
  transit: ArrowRightLeft,
  visa_on_arrival: MapPin,
};

function purposeIcon(purpose: string): LucideIcon {
  return PURPOSE_ICONS[purpose.toLowerCase()] || Plane;
}

function titleCaseDuration(value: string) {
  return value.replace(/\b[a-z]/g, (char) => char.toUpperCase());
}

function entryLabel(isMultipleEntry: boolean) {
  return isMultipleEntry ? 'Multi-entry' : 'Single-entry';
}

function entryWord(isMultipleEntry: boolean) {
  return isMultipleEntry ? 'Multiple' : 'Single';
}

function packageTitle(option: PriceOptionView, isMultipleEntry: boolean) {
  const stay = titleCaseDuration(
    (option.stayDuration || option.daysLabel || 'Visa package').trim()
  );
  return `${stay} · ${entryLabel(isMultipleEntry)}`;
}

function processingLabel(eta: string | null | undefined) {
  if (!eta?.trim()) return null;
  const cleaned = eta.trim().replace(/^in\s+/i, '');
  return `Visa in ${cleaned}`;
}

function resolveActiveVisaKind(
  visaKinds: VisaKindOption[],
  currentListingId?: string
) {
  return (
    visaKinds.find((kind) =>
      kind.listings.some((listing) => listing.id === currentListingId)
    ) ||
    visaKinds.find((kind) => kind.id === currentListingId) ||
    visaKinds[0]
  );
}

interface VisaTypesOfferedProps {
  countryName: string;
  processingEta: string | null;
  isMultipleEntry: boolean;
  priceOptions: PriceOptionView[];
  selectedId?: string;
  onSelectedIdChange: (id: string) => void;
  visaKinds?: VisaKindOption[];
  currentListingId?: string;
  onVisaKindSelect?: (kind: VisaKindOption) => Promise<boolean> | boolean;
}

function VisaKindTabs({
  visaKinds,
  currentListingId,
  onSelect,
}: {
  visaKinds: VisaKindOption[];
  currentListingId?: string;
  onSelect?: (kind: VisaKindOption) => Promise<boolean> | boolean;
}) {
  const router = useRouter();
  const current = resolveActiveVisaKind(visaKinds, currentListingId);
  const [pendingPurpose, setPendingPurpose] = useState(current?.purpose);
  const switchingRef = useRef(false);

  useEffect(() => {
    setPendingPurpose(current?.purpose);
  }, [current?.purpose]);

  useEffect(() => {
    visaKinds.forEach((kind) => {
      kind.listings.forEach((listing) => {
        if (listing.id !== currentListingId) router.prefetch(listing.href);
      });
    });
  }, [visaKinds, currentListingId, router]);

  if (!current || visaKinds.length < 2) return null;

  const activePurpose = pendingPurpose || current.purpose;

  return (
    <div
      role="tablist"
      aria-label="Visa type"
      className="flex w-full gap-1 rounded-full bg-[#eceff3] p-1"
    >
      {visaKinds.map((kind) => {
        const isActive = kind.purpose === activePurpose;
        const Icon = purposeIcon(kind.purpose);

        return (
          <button
            key={kind.purpose}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => {
              if (switchingRef.current) return;

              const alreadyInGroup = kind.listings.some(
                (listing) => listing.id === currentListingId
              );
              if (alreadyInGroup) {
                setPendingPurpose(kind.purpose);
                return;
              }

              const previousPurpose = current.purpose;
              setPendingPurpose(kind.purpose);

              const navigate = async () => {
                switchingRef.current = true;
                try {
                  if (onSelect) {
                    const ok = await onSelect(kind);
                    if (!ok) setPendingPurpose(previousPurpose);
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
            className={cn(
              'relative inline-flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-2.5 text-sm font-medium transition-colors',
              isActive
                ? 'bg-white text-portrait-ink shadow-sm'
                : 'text-slate-helper hover:text-portrait-ink'
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            <span className="whitespace-nowrap">
              {visaPurposeTabLabel(kind.purpose) || kind.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function SelectableCard({
  title,
  price,
  selected,
  detail,
  processText,
  processingEta,
  formattedTotal,
  onSelect,
}: {
  title: string;
  price: string;
  selected: boolean;
  detail: ReactNode;
  processText: string | null;
  processingEta: string | null;
  formattedTotal: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      onClick={onSelect}
      aria-checked={selected}
      className={cn(
        'w-full rounded-2xl border bg-white p-4 text-left transition-colors sm:rounded-[18px] sm:p-5',
        selected
          ? 'border-nautical-teal shadow-[0_8px_24px_rgba(8,78,114,0.08)]'
          : 'border-ash-divider hover:border-fog'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span
            className={cn(
              'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
              selected
                ? 'border-nautical-teal bg-nautical-teal text-white'
                : 'border-fog bg-white'
            )}
            aria-hidden
          >
            {selected ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
          </span>
          <h3 className="text-[15px] font-semibold leading-snug text-portrait-ink sm:text-base">
            {title}
          </h3>
        </div>
        <p className="shrink-0 text-[15px] font-semibold tabular-nums text-portrait-ink sm:text-base">
          {price}
        </p>
      </div>

      <p className="mt-3 pl-7 text-[12px] leading-6 text-slate-helper sm:text-[13px]">
        {detail}
      </p>

      {processText ? (
        <div className={selected ? 'mt-4 pl-7' : 'mt-3 pl-7'}>
          <div
            className={
              selected
                ? 'inline-flex items-center gap-3 rounded-xl border border-nautical-teal/35 bg-sky-wash px-3.5 py-2.5 text-[13px] text-portrait-ink sm:rounded-2xl'
                : 'inline-flex items-center gap-2 rounded-full bg-sky-wash px-3 py-1 text-[12px] text-portrait-ink'
            }
          >
            <span>
              Visa in{' '}
              <span className="font-semibold">
                {processingEta?.trim().replace(/^in\s+/i, '')}
              </span>
            </span>
            <span className="font-semibold tabular-nums">{formattedTotal}</span>
          </div>
        </div>
      ) : null}
    </button>
  );
}

function PackageCard({
  option,
  selected,
  isMultipleEntry,
  processingEta,
  onSelect,
}: {
  option: PriceOptionView;
  selected: boolean;
  isMultipleEntry: boolean;
  processingEta: string | null;
  onSelect: () => void;
}) {
  const validity = option.entryValidity
    ? titleCaseDuration(option.entryValidity)
    : null;
  const stay = option.stayDuration
    ? titleCaseDuration(option.stayDuration)
    : option.daysLabel
      ? titleCaseDuration(option.daysLabel)
      : null;
  const processText = processingLabel(processingEta);

  const detail = [
    validity ? (
      <span key="validity">
        Valid for{' '}
        <span className="font-semibold text-portrait-ink">{validity}</span>
      </span>
    ) : null,
    stay ? (
      <span key="stay">
        Maximum stay of{' '}
        <span className="font-semibold text-portrait-ink">{stay}</span>
      </span>
    ) : null,
    <span key="entry">
      Entry{' '}
      <span className="font-semibold text-portrait-ink">
        {entryWord(isMultipleEntry)}
      </span>
    </span>,
  ]
    .filter(Boolean)
    .reduce<ReactNode[]>((acc, node, index) => {
      if (index > 0) {
        acc.push(
          <span key={`sep-${index}`} className="mx-1.5 text-fog">
            |
          </span>
        );
      }
      acc.push(node);
      return acc;
    }, []);

  return (
    <SelectableCard
      title={packageTitle(option, isMultipleEntry)}
      price={option.formattedTotal}
      selected={selected}
      detail={detail}
      processText={processText}
      processingEta={processingEta}
      formattedTotal={option.formattedTotal}
      onSelect={onSelect}
    />
  );
}

function ListingOptionCard({
  listing,
  selected,
  processingEta,
  onSelect,
}: {
  listing: VisaKindListingOption;
  selected: boolean;
  processingEta: string | null;
  onSelect: () => void;
}) {
  const stay = listing.stayDuration
    ? titleCaseDuration(listing.stayDuration)
    : null;
  const processText = selected ? processingLabel(processingEta) : null;

  const detail = [
    stay ? (
      <span key="stay">
        Maximum stay of{' '}
        <span className="font-semibold text-portrait-ink">{stay}</span>
      </span>
    ) : null,
    <span key="entry">
      Entry{' '}
      <span className="font-semibold text-portrait-ink">
        {entryWord(listing.isMultipleEntry)}
      </span>
    </span>,
  ]
    .filter(Boolean)
    .reduce<ReactNode[]>((acc, node, index) => {
      if (index > 0) {
        acc.push(
          <span key={`sep-${index}`} className="mx-1.5 text-fog">
            |
          </span>
        );
      }
      acc.push(node);
      return acc;
    }, []);

  return (
    <SelectableCard
      title={listing.processName}
      price={listing.formattedStartingPrice}
      selected={selected}
      detail={detail}
      processText={processText}
      processingEta={processingEta}
      formattedTotal={listing.formattedStartingPrice}
      onSelect={onSelect}
    />
  );
}

export function VisaTypesOffered({
  countryName,
  processingEta,
  isMultipleEntry,
  priceOptions,
  selectedId,
  onSelectedIdChange,
  visaKinds = [],
  currentListingId,
  onVisaKindSelect,
}: VisaTypesOfferedProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const switchingRef = useRef(false);

  const activeGroup = resolveActiveVisaKind(visaKinds, currentListingId);
  const siblingListings = activeGroup?.listings ?? [];
  const showListingOptions = siblingListings.length > 1;

  const visibleOptions = useMemo(() => {
    if (expanded || priceOptions.length <= VISIBLE_OPTIONS) return priceOptions;
    return priceOptions.slice(0, VISIBLE_OPTIONS);
  }, [expanded, priceOptions]);

  const hiddenCount = Math.max(0, priceOptions.length - VISIBLE_OPTIONS);

  const selectListing = async (listing: VisaKindListingOption) => {
    if (listing.id === currentListingId || switchingRef.current) return;
    if (!activeGroup) return;

    switchingRef.current = true;
    try {
      const kind: VisaKindOption = {
        ...activeGroup,
        id: listing.id,
        href: listing.href,
      };
      if (onVisaKindSelect) {
        await onVisaKindSelect(kind);
        return;
      }
      beginVisaKindNavigation();
      router.push(listing.href, { scroll: false });
    } finally {
      switchingRef.current = false;
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      <h2 className="font-basier text-2xl leading-tight text-portrait-ink sm:text-[2rem]">
        All visa types offered.
      </h2>

      <VisaKindTabs
        visaKinds={visaKinds}
        currentListingId={currentListingId}
        onSelect={onVisaKindSelect}
      />

      {showListingOptions ? (
        <div
          className="space-y-3"
          role="radiogroup"
          aria-label="Visa options for this type"
        >
          {siblingListings.map((listing) => (
            <ListingOptionCard
              key={listing.id}
              listing={listing}
              selected={listing.id === currentListingId}
              processingEta={
                listing.id === currentListingId ? processingEta : null
              }
              onSelect={() => void selectListing(listing)}
            />
          ))}
        </div>
      ) : null}

      {!showListingOptions || priceOptions.length > 1 ? (
        <div
          className="space-y-3"
          role="radiogroup"
          aria-label="Visa packages"
        >
          {showListingOptions && priceOptions.length > 1 ? (
            <p className="text-xs uppercase tracking-[0.2em] text-slate-helper">
              Stay options
            </p>
          ) : null}
          {visibleOptions.map((option) => (
            <PackageCard
              key={option.id}
              option={option}
              selected={option.id === selectedId}
              isMultipleEntry={isMultipleEntry}
              processingEta={processingEta}
              onSelect={() => onSelectedIdChange(option.id)}
            />
          ))}
        </div>
      ) : null}

      {!showListingOptions && hiddenCount > 0 ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-nautical-teal transition-colors hover:text-portrait-ink"
        >
          {expanded
            ? 'Show fewer options'
            : `Travel to ${countryName} often? View ${hiddenCount} more option${
                hiddenCount === 1 ? '' : 's'
              }`}
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 transition-transform',
              expanded && 'rotate-180'
            )}
            aria-hidden
          />
        </button>
      ) : null}
    </div>
  );
}
