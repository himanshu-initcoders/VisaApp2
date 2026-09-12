'use client';

import type { Ref } from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DestinationSearchBarProps {
  variant?: 'hero' | 'nav' | 'panel';
  query?: string;
  onQueryChange?: (value: string) => void;
  onActivate?: () => void;
  placeholder?: string;
  className?: string;
  inputRef?: Ref<HTMLInputElement>;
}

export function DestinationSearchBar({
  variant = 'hero',
  query = '',
  onQueryChange,
  onActivate,
  placeholder,
  className,
  inputRef,
}: DestinationSearchBarProps) {
  const isNav = variant === 'nav';
  const isPanel = variant === 'panel';
  const label =
    placeholder ||
    (isNav || isPanel
      ? 'Search Country'
      : 'Search destinations like Dubai or Japan');

  const shellClass = cn(
    'flex w-full items-center rounded-full border border-ash-divider bg-white text-left transition-shadow',
    isNav
      ? 'h-10 gap-2 px-3 shadow-card'
      : isPanel
        ? 'h-11 gap-2 px-4 shadow-card sm:h-12'
        : 'h-12 gap-3 px-4 shadow-elevated sm:h-14 sm:px-5',
    !isPanel && 'hover:border-portrait-ink/20',
    isPanel && 'focus-within:shadow-[0_0_0_3px_rgba(8,48,76,0.08)]',
    className
  );

  if (isPanel) {
    return (
      <label className={shellClass}>
        <Search className="h-4 w-4 shrink-0 text-slate-helper" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(event) => onQueryChange?.(event.target.value)}
          placeholder={label}
          className="min-w-0 flex-1 bg-transparent text-sm text-portrait-ink outline-none placeholder:text-slate-helper sm:text-base"
          aria-label={label}
        />
        {query && (
          <button
            type="button"
            onClick={() => onQueryChange?.('')}
            className="shrink-0 text-xs text-slate-helper"
          >
            Clear
          </button>
        )}
      </label>
    );
  }

  return (
    <button
      type="button"
      onClick={onActivate}
      className={shellClass}
      aria-label={label}
    >
      <Search className={cn('shrink-0 text-slate-helper', isNav ? 'h-4 w-4' : 'h-5 w-5')} />
      <span className="min-w-0 flex-1 truncate text-sm text-slate-helper sm:text-base">
        {label}
      </span>
    </button>
  );
}
