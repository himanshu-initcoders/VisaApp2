'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface ToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
  /** On-state track color. Default mint matches admin toggles; ink for applicant checkout. */
  activeTone?: 'mint' | 'ink';
  'aria-label'?: string;
}

/**
 * Toggle Switch Component - Portrait Design System
 *
 * A pill-shaped toggle switch following the Portrait design system.
 * - Height: 28px (pill shape)
 * - Enabled: Mint Wash (#d7ffe2) or Portrait Ink (#08304c)
 * - Off: Fog (#c7c7c7) — ink tone adds an ink outline so it stays visible on white
 * - Smooth transition animation
 *
 * @example
 * <Toggle
 *   enabled={isEnabled}
 *   onChange={setIsEnabled}
 *   label="Enable feature"
 * />
 */
export const Toggle = React.forwardRef<HTMLButtonElement, ToggleProps>(
  (
    {
      enabled,
      onChange,
      label,
      disabled,
      className,
      activeTone = 'mint',
      'aria-label': ariaLabel,
    },
    ref
  ) => {
    const handleToggle = () => {
      if (!disabled) {
        onChange(!enabled);
      }
    };

    return (
      <label className={cn('flex items-center gap-3 cursor-pointer', className)}>
        {label && (
          <span
            className={cn(
              'text-sm font-medium',
              disabled ? 'text-slate-helper' : 'text-portrait-ink'
            )}
          >
            {label}
          </span>
        )}

        <button
          ref={ref}
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={ariaLabel || label || 'Toggle'}
          disabled={disabled}
          onClick={handleToggle}
          className={cn(
            'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-portrait-ink focus:ring-offset-2',
            enabled
              ? activeTone === 'ink'
                ? 'border-portrait-ink bg-portrait-ink'
                : 'border-mint-wash bg-mint-wash'
              : activeTone === 'ink'
                ? 'border-portrait-ink/40 bg-mist'
                : 'border-fog bg-fog',
            disabled && 'cursor-not-allowed opacity-50'
          )}
        >
          <span
            className={cn(
              'inline-block h-5 w-5 transform rounded-full bg-white shadow-[0_1px_3px_rgba(8,48,76,0.28)] transition-transform duration-200',
              enabled ? 'translate-x-6' : 'translate-x-1'
            )}
          />
        </button>
      </label>
    );
  }
);

Toggle.displayName = 'Toggle';
