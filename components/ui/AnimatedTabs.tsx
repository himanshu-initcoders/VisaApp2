'use client';

import { useEffect, useRef } from 'react';
import { LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface AnimatedTabItem {
  id: string;
  label: string;
  disabled?: boolean;
  /** Red dot beside the label. Used when this section still has requested changes. */
  dot?: boolean;
  /** Accessible name for the red dot. Defaults to the correction-wizard wording. */
  dotLabel?: string;
}

interface AnimatedTabsProps {
  items: AnimatedTabItem[];
  value: string;
  onChange: (id: string) => void;
  tone?: 'dark' | 'light';
  ariaLabel?: string;
  layoutId: string;
  className?: string;
}

export function AnimatedTabs({
  items,
  value,
  onChange,
  tone = 'dark',
  ariaLabel,
  layoutId,
  className,
}: AnimatedTabsProps) {
  const reduceMotion = useReducedMotion();
  const listRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  useEffect(() => {
    const list = listRef.current;
    const active = tabRefs.current.get(value);
    if (!list || !active) return;

    // Keep the active tab in view (and prefer centering) as Continue advances past
    // the first few tabs on narrow screens.
    const listRect = list.getBoundingClientRect();
    const tabRect = active.getBoundingClientRect();
    const tabCenter = tabRect.left + tabRect.width / 2;
    const listCenter = listRect.left + listRect.width / 2;
    const delta = tabCenter - listCenter;
    const maxScroll = list.scrollWidth - list.clientWidth;
    if (maxScroll <= 0) return;

    const nextLeft = Math.max(0, Math.min(maxScroll, list.scrollLeft + delta));
    if (Math.abs(nextLeft - list.scrollLeft) < 1) return;

    list.scrollTo({
      left: nextLeft,
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  }, [value, items.length, reduceMotion]);

  if (items.length < 2) return null;

  const isDark = tone === 'dark';
  // 4+ tabs overflow on narrow screens — keep content width + horizontal scroll there.
  const manyTabs = items.length > 3;
  const stretchDesktop = items.length <= 6;

  return (
    <LayoutGroup id={layoutId}>
      <div
        ref={listRef}
        role="tablist"
        aria-label={ariaLabel}
        className={cn(
          'relative flex w-full gap-1 overflow-x-auto rounded-full p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          manyTabs ? 'justify-start sm:justify-center' : '',
          isDark ? 'bg-white/10' : 'bg-[#f3f4f6]',
          className
        )}
      >
        {items.map((item) => {
          const isActive = item.id === value;
          const isDisabled = Boolean(item.disabled);

          return (
            <button
              key={item.id}
              ref={(node) => {
                if (node) tabRefs.current.set(item.id, node);
                else tabRefs.current.delete(item.id);
              }}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-disabled={isDisabled}
              disabled={isDisabled}
              onClick={() => {
                if (isDisabled) return;
                onChange(item.id);
              }}
              className={cn(
                'relative z-10 rounded-full px-3 py-2 text-sm font-medium transition-colors',
                manyTabs
                  ? stretchDesktop
                    ? 'shrink-0 sm:flex-1'
                    : 'shrink-0'
                  : 'flex-1',
                isDisabled && 'cursor-not-allowed opacity-40',
                isActive
                  ? isDark
                    ? 'text-white'
                    : 'text-portrait-ink'
                  : isDark
                    ? 'text-white/55 hover:text-white'
                    : 'text-slate-helper hover:text-portrait-ink'
              )}
            >
              {isActive && (
                <motion.span
                  layoutId={`${layoutId}-pill`}
                  className={cn(
                    'absolute inset-0 -z-10 rounded-full',
                    isDark
                      ? 'bg-white/16 shadow-sm ring-1 ring-white/20'
                      : 'bg-white shadow-sm'
                  )}
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : { type: 'spring', stiffness: 380, damping: 32 }
                  }
                />
              )}
              <span className="relative z-10 inline-flex items-center justify-center gap-1.5 whitespace-nowrap">
                {item.label}
                {item.dot ? (
                  <span
                    className="h-2 w-2 shrink-0 rounded-full bg-[#ff4940]"
                    aria-label={item.dotLabel ?? 'Changes requested'}
                  />
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
