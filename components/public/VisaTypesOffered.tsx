'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronDown, FileText } from 'lucide-react';
import { beginVisaKindNavigation } from '@/components/public/PreserveListingView';
import type {
  PriceOptionView,
  VisaKindListingOption,
  VisaKindOption,
} from '@/components/public/PricingPanel';
import { AnimatedTabs } from '@/components/ui';
import { visaPurposeTabLabel } from '@/lib/visa/purposes';
import { cn } from '@/lib/utils';

const VISIBLE_OPTIONS = 2;

function titleCaseDuration(value: string) {
  return value.replace(/\b[a-z]/g, (char) => char.toUpperCase());
}

function entryLabel(isMultipleEntry: boolean) {
  return isMultipleEntry ? 'Multi-entry' : 'Single-entry';
}

function entryWord(isMultipleEntry: boolean) {
  return isMultipleEntry ? 'Multiple' : 'Single';
}

function packageTitle(
  option: PriceOptionView,
  isMultipleEntry: boolean,
  processTypeLabel?: string | null
) {
  if (processTypeLabel?.trim()) return processTypeLabel.trim();
  const stay = titleCaseDuration(
    (option.stayDuration || option.daysLabel || 'Visa package').trim()
  );
  return `${stay} · ${entryLabel(isMultipleEntry)}`;
}

/** "30 days" → "30 working days"; leave hours/minutes/etc. unchanged. */
function formatProcessingEta(eta: string) {
  const cleaned = eta.trim().replace(/^in\s+/i, '');
  if (/\bworking\s+days?\b/i.test(cleaned)) return cleaned;
  return cleaned.replace(
    /\b(\d+)\s+(days?)\b/i,
    (_, count: string, unit: string) => `${count} working ${unit}`
  );
}

function processingLabel(
  eta: string | null | undefined,
  purposeLabel: string
) {
  if (!eta?.trim()) return null;
  return `${purposeLabel} in ${formatProcessingEta(eta)}`;
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

function scrollToRequirements(event: MouseEvent<HTMLAnchorElement>) {
  event.preventDefault();
  event.stopPropagation();
  const section = document.getElementById('requirements');
  if (!section) return;
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  window.history.replaceState(null, '', '#requirements');
}

interface VisaTypesOfferedProps {
  countryName: string;
  processingEta: string | null;
  isMultipleEntry: boolean;
  processTypeLabel?: string | null;
  priceOptions: PriceOptionView[];
  selectedId?: string;
  onSelectedIdChange: (id: string) => void;
  visaKinds?: VisaKindOption[];
  currentListingId?: string;
  hasRequiredDocuments?: boolean;
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
    <AnimatedTabs
      items={visaKinds.map((kind) => ({
        id: kind.purpose,
        label: visaPurposeTabLabel(kind.purpose) || kind.label,
      }))}
      value={activePurpose}
      onChange={(purpose) => {
        const kind = visaKinds.find((item) => item.purpose === purpose);
        if (!kind || switchingRef.current) return;

        const alreadyInGroup = kind.listings.some(
          (listing) => listing.id === currentListingId
        );
        if (alreadyInGroup) {
          setPendingPurpose(purpose);
          return;
        }

        const previousPurpose = current.purpose;
        setPendingPurpose(purpose);

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
      tone="light"
      ariaLabel="Visa type"
      layoutId="visa-kind-tabs-overview"
    />
  );
}

function SelectableCard({
  title,
  price,
  selected,
  detail,
  processText,
  purposeLabel,
  processingEta,
  formattedTotal,
  hasRequiredDocuments,
  onSelect,
}: {
  title: string;
  price: string;
  selected: boolean;
  detail: ReactNode;
  processText: string | null;
  purposeLabel: string;
  processingEta: string | null;
  formattedTotal: string;
  hasRequiredDocuments?: boolean;
  onSelect: () => void;
}) {
  const showDocumentsLink = Boolean(hasRequiredDocuments && selected);
  const showFooter = Boolean(processText || showDocumentsLink);
  const etaDisplay = processingEta ? formatProcessingEta(processingEta) : null;

  return (
    <div
      role="radio"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
      aria-checked={selected}
      className={cn(
        'w-full cursor-pointer rounded-2xl border bg-white p-4 text-left transition-colors sm:rounded-[18px] sm:p-5',
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

      {showFooter ? (
        <div
          className={cn(
            'flex flex-col gap-3 pl-7 sm:flex-row sm:items-center sm:justify-between',
            selected ? 'mt-4' : 'mt-3'
          )}
        >
          {processText && etaDisplay ? (
            <div
              className={
                selected
                  ? 'flex w-full items-center justify-between gap-3 rounded-xl border border-nautical-teal/35 bg-sky-wash px-4 py-3.5 text-[13px] leading-snug text-portrait-ink sm:w-auto sm:rounded-2xl sm:gap-4 sm:px-5 sm:py-4'
                  : 'inline-flex w-fit items-center gap-2 rounded-full bg-sky-wash px-3.5 py-2 text-[12px] text-portrait-ink'
              }
            >
              <span className="min-w-0">
                {purposeLabel} in{' '}
                <span className="font-semibold">{etaDisplay}</span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums">
                {formattedTotal}
              </span>
            </div>
          ) : null}

          {showDocumentsLink ? (
            <a
              href="#requirements"
              onClick={scrollToRequirements}
              className="inline-flex shrink-0 items-center gap-1.5 text-[13px] font-medium text-nautical-teal transition-colors hover:text-portrait-ink"
            >
              <FileText className="h-4 w-4 shrink-0" aria-hidden />
              View required documents
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function PackageCard({
  option,
  selected,
  isMultipleEntry,
  processingEta,
  processTypeLabel,
  purposeLabel,
  hasRequiredDocuments,
  onSelect,
}: {
  option: PriceOptionView;
  selected: boolean;
  isMultipleEntry: boolean;
  processingEta: string | null;
  processTypeLabel?: string | null;
  purposeLabel: string;
  hasRequiredDocuments?: boolean;
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
  const processText = processingLabel(processingEta, purposeLabel);

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
      title={packageTitle(option, isMultipleEntry, processTypeLabel)}
      price={option.formattedTotal}
      selected={selected}
      detail={detail}
      processText={processText}
      purposeLabel={purposeLabel}
      processingEta={processingEta}
      formattedTotal={option.formattedTotal}
      hasRequiredDocuments={hasRequiredDocuments}
      onSelect={onSelect}
    />
  );
}

function ListingOptionCard({
  listing,
  selected,
  processingEta,
  purposeLabel,
  hasRequiredDocuments,
  onSelect,
}: {
  listing: VisaKindListingOption;
  selected: boolean;
  processingEta: string | null;
  purposeLabel: string;
  hasRequiredDocuments?: boolean;
  onSelect: () => void;
}) {
  const stay = listing.stayDuration
    ? titleCaseDuration(listing.stayDuration)
    : null;
  const processText = selected
    ? processingLabel(processingEta, purposeLabel)
    : null;

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
      title={listing.processTypeLabel || listing.processName}
      price={listing.formattedStartingPrice}
      selected={selected}
      detail={detail}
      processText={processText}
      purposeLabel={purposeLabel}
      processingEta={processingEta}
      formattedTotal={listing.formattedStartingPrice}
      hasRequiredDocuments={hasRequiredDocuments}
      onSelect={onSelect}
    />
  );
}

export function VisaTypesOffered({
  countryName,
  processingEta,
  isMultipleEntry,
  processTypeLabel,
  priceOptions,
  selectedId,
  onSelectedIdChange,
  visaKinds = [],
  currentListingId,
  hasRequiredDocuments = false,
  onVisaKindSelect,
}: VisaTypesOfferedProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const switchingRef = useRef(false);

  const activeGroup = resolveActiveVisaKind(visaKinds, currentListingId);
  const siblingListings = activeGroup?.listings ?? [];
  const showListingOptions = siblingListings.length > 1;
  const purposeLabel =
    (activeGroup
      ? visaPurposeTabLabel(activeGroup.purpose) || activeGroup.label
      : null) || 'Visa';

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
              purposeLabel={purposeLabel}
              hasRequiredDocuments={
                listing.id === currentListingId ? hasRequiredDocuments : false
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
              processTypeLabel={processTypeLabel}
              purposeLabel={purposeLabel}
              hasRequiredDocuments={hasRequiredDocuments}
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
