'use client';

import { LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface AnimatedTabItem {
  id: string;
  label: string;
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

  if (items.length < 2) return null;

  const isDark = tone === 'dark';
  const stretch = items.length <= 4;

  return (
    <LayoutGroup id={layoutId}>
      <div
        role="tablist"
        aria-label={ariaLabel}
        className={cn(
          'relative flex w-full gap-1 overflow-x-auto rounded-full p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          isDark ? 'bg-white/10' : 'bg-[#f3f4f6]',
          className
        )}
      >
        {items.map((item) => {
          const isActive = item.id === value;

          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(item.id)}
              className={cn(
                'relative z-10 rounded-full px-3 py-2 text-sm font-medium transition-colors',
                stretch ? 'flex-1' : 'shrink-0',
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
              <span className="relative z-10 whitespace-nowrap">{item.label}</span>
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
