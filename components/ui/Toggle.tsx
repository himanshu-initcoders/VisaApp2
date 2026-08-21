'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface ToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Toggle Switch Component - Portrait Design System
 *
 * A pill-shaped toggle switch following the Portrait design system.
 * - Height: 28px (pill shape)
 * - Enabled: Mint Wash background (#d7ffe2)
 * - Disabled: Fog Edge background (#c7c7c7)
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
  ({ enabled, onChange, label, disabled, className }, ref) => {
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
          aria-label={label || 'Toggle'}
          disabled={disabled}
          onClick={handleToggle}
          className={cn(
            // Base styles
            'relative inline-flex items-center h-7 w-12 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-portrait-ink focus:ring-offset-2',
            // Background colors
            enabled ? 'bg-mint-wash' : 'bg-fog-edge',
            // Disabled state
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          {/* Toggle knob */}
          <span
            className={cn(
              'inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200',
              enabled ? 'translate-x-6' : 'translate-x-1'
            )}
          />
        </button>
      </label>
    );
  }
);

Toggle.displayName = 'Toggle';
