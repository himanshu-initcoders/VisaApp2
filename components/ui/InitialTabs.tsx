'use client';

import { cn } from '@/lib/utils';

export interface InitialTabItem {
  id: string;
  /** Full display name (tooltip + aria). */
  label: string;
  /** Optional override for the letter shown in the circle. */
  initial?: string;
}

interface InitialTabsProps {
  items: InitialTabItem[];
  value: string;
  onChange: (id: string) => void;
  ariaLabel?: string;
  className?: string;
  /** Show the selected traveller name beside the circles. */
  showActiveLabel?: boolean;
}

function letterFor(item: InitialTabItem): string {
  if (item.initial?.trim()) {
    return item.initial.trim().charAt(0).toUpperCase();
  }
  const name = item.label.trim();
  if (!name) return '?';
  return name.charAt(0).toUpperCase();
}

/**
 * Horizontal first-letter circle tabs — useful for switching travellers
 * without scrolling a long stacked list.
 */
export function InitialTabs({
  items,
  value,
  onChange,
  ariaLabel = 'Travellers',
  className,
  showActiveLabel = true,
}: InitialTabsProps) {
  if (items.length === 0) return null;

  const active = items.find((item) => item.id === value) ?? items[0];

  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      <div
        role="tablist"
        aria-label={ariaLabel}
        className="flex flex-wrap items-center gap-2"
      >
        {items.map((item, index) => {
          const isActive = item.id === (active?.id ?? value);
          const letter = letterFor(item);

          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={item.label || `Traveller ${index + 1}`}
              title={item.label || `Traveller ${index + 1}`}
              onClick={() => onChange(item.id)}
              className={cn(
                'flex h-11 w-11 items-center justify-center rounded-full',
                'font-switzer text-sm font-semibold transition-all',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-portrait-ink/30',
                isActive
                  ? 'bg-portrait-ink text-white shadow-sm ring-2 ring-portrait-ink ring-offset-2'
                  : 'bg-sky-wash/70 text-portrait-ink hover:bg-sky-wash'
              )}
            >
              {letter}
            </button>
          );
        })}
      </div>

      {showActiveLabel && active && (
        <div className="min-w-0">
          <p className="font-switzer text-xs text-slate-helper">Traveller</p>
          <p className="truncate font-switzer text-sm font-medium text-portrait-ink">
            {active.label || 'Unnamed'}
            {items.length > 1
              ? ` · ${items.findIndex((i) => i.id === active.id) + 1} of ${items.length}`
              : ''}
          </p>
        </div>
      )}
    </div>
  );
}
