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
  Users,
  type LucideIcon,
} from 'lucide-react';
import { beginVisaKindNavigation } from '@/components/public/PreserveListingView';
import type {
  PriceOptionView,
  VisaKindOption,
} from '@/components/public/PricingPanel';
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
};

function purposeIcon(purpose: string): LucideIcon {
  return PURPOSE_ICONS[purpose.toLowerCase()] || Plane;
}

function titleCaseDuration(value: string) {
  return value.replace(/\b[a-z]/g, (char) => char.toUpperCase());
}

function visaKindLabel(label: string, purpose?: string) {
  if (purpose?.toLowerCase() === 'tourism') return 'Tourist Visa';
  const trimmed = label.trim();
  if (!trimmed) return 'Visa';
  return /visa/i.test(trimmed) ? trimmed : `${trimmed} Visa`;
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

  return (
    <div
      role="tablist"
      aria-label="Visa type"
      className="flex w-full gap-1 rounded-full bg-[#eceff3] p-1"
    >
      {visaKinds.map((kind) => {
        const isActive = kind.id === (pendingId || current.id);
        const Icon = purposeIcon(kind.purpose);

        return (
          <button
            key={kind.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => {
              if (kind.id === current.id || switchingRef.current) return;

              const previousId = current.id;
              setPendingId(kind.id);

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
            className={cn(
              'relative inline-flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-2.5 text-sm font-medium transition-colors',
              isActive
                ? 'bg-white text-portrait-ink shadow-sm'
                : 'text-slate-helper hover:text-portrait-ink'
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            <span className="whitespace-nowrap">
              {visaKindLabel(kind.label, kind.purpose)}
            </span>
          </button>
        );
      })}
    </div>
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

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
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
            {packageTitle(option, isMultipleEntry)}
          </h3>
        </div>
        <p className="shrink-0 text-[15px] font-semibold tabular-nums text-portrait-ink sm:text-base">
          {option.formattedTotal}
        </p>
      </div>

      <p className="mt-3 pl-7 text-[12px] leading-6 text-slate-helper sm:text-[13px]">
        {[
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
          }, [])}
      </p>

      {processText ? (
        selected ? (
          <div className="mt-4 pl-7">
            <div className="inline-flex items-center gap-3 rounded-xl border border-nautical-teal/35 bg-sky-wash px-3.5 py-2.5 text-[13px] text-portrait-ink sm:rounded-2xl">
              <span>
                Visa in{' '}
                <span className="font-semibold">
                  {processingEta?.trim().replace(/^in\s+/i, '')}
                </span>
              </span>
              <span className="font-semibold tabular-nums">
                {option.formattedTotal}
              </span>
            </div>
          </div>
        ) : (
          <div className="mt-3 pl-7">
            <span className="inline-flex rounded-full bg-sky-wash px-3 py-1 text-[12px] text-portrait-ink">
              Visa in{' '}
              <span className="ml-1 font-semibold">
                {processingEta?.trim().replace(/^in\s+/i, '')}
              </span>
            </span>
          </div>
        )
      ) : null}
    </button>
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
  const [expanded, setExpanded] = useState(false);

  const visibleOptions = useMemo(() => {
    if (expanded || priceOptions.length <= VISIBLE_OPTIONS) return priceOptions;
    return priceOptions.slice(0, VISIBLE_OPTIONS);
  }, [expanded, priceOptions]);

  const hiddenCount = Math.max(0, priceOptions.length - VISIBLE_OPTIONS);

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

      <div className="space-y-3" role="listbox" aria-label="Visa packages">
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

      {hiddenCount > 0 ? (
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
