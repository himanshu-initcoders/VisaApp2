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
  const isHero = variant === 'hero';
  const label =
    placeholder ||
    (isNav || isPanel
      ? 'Search Country'
      : 'Search destinations like Dubai or Japan');

  const shellClass = cn(
    'flex w-full items-center rounded-full border border-ash bg-white text-left transition-shadow',
    isNav
      ? 'h-10 gap-2 px-3 shadow-card'
      : isPanel
        ? 'h-11 gap-2 px-4 shadow-card sm:h-12'
        : 'shadow-elevated hover:shadow-[0_8px_28px_rgba(8,48,76,0.12)]',
    !isPanel && !isHero && 'hover:border-portrait-ink/20',
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

  if (isHero) {
    return (
      <button
        type="button"
        onClick={onActivate}
        className={cn(shellClass, 'h-[64px] gap-0 py-2 pl-2 pr-2 sm:h-[72px] sm:pl-2 sm:pr-2')}
        aria-label={label}
      >
        <span className="hidden h-full min-w-[148px] items-center gap-2.5 border-r border-ash px-4 sm:flex">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-wash text-[10px] font-bold tracking-wide text-portrait-ink">
            IN
          </span>
          <span className="text-left">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-helper">
              Passport
            </span>
            <span className="block text-sm font-semibold text-portrait-ink">
              India
            </span>
          </span>
        </span>

        <span className="flex min-w-0 flex-1 items-center gap-3 px-4">
          <Search className="h-5 w-5 shrink-0 text-slate-helper sm:hidden" />
          <span className="min-w-0 text-left">
            <span className="block text-sm font-semibold text-portrait-ink">
              Where to?
            </span>
            <span className="block truncate text-xs text-slate-helper">
              {label}
            </span>
          </span>
        </span>

        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-portrait-ink text-white sm:h-14 sm:w-14">
          <Search className="h-5 w-5" aria-hidden />
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onActivate}
      className={cn(shellClass, 'h-10 gap-2 px-3')}
      aria-label={label}
    >
      <Search className="h-4 w-4 shrink-0 text-slate-helper" />
      <span className="min-w-0 flex-1 truncate text-sm text-slate-helper">
        {label}
      </span>
    </button>
  );
}
