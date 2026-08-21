'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  error?: string;
  className?: string;
}

/**
 * Checkbox Component - Portrait Design System
 *
 * A checkbox following the Portrait design system.
 * - Size: 16px square
 * - Border radius: 4px
 * - Checked: Mint Wash background (#d7ffe2)
 * - Unchecked: White with Portrait Ink border
 * - Checkmark: Portrait Ink
 *
 * @example
 * <Checkbox
 *   checked={isChecked}
 *   onChange={setIsChecked}
 *   label="I agree to terms"
 *   description="By checking this, you agree to our terms and conditions"
 * />
 */
export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ checked, onChange, label, description, disabled, error, className }, ref) => {
    const id = React.useId();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!disabled) {
        onChange(e.target.checked);
      }
    };

    return (
      <div className={cn('flex items-start gap-2', className)}>
        <div className="relative flex items-center">
          <input
            ref={ref}
            id={id}
            type="checkbox"
            checked={checked}
            onChange={handleChange}
            disabled={disabled}
            className="sr-only peer"
            aria-describedby={description ? `${id}-description` : undefined}
            aria-invalid={!!error}
          />

          <label
            htmlFor={id}
            className={cn(
              // Base styles
              'flex items-center justify-center w-4 h-4 rounded cursor-pointer transition-all',
              // Border
              'border',
              error
                ? 'border-red-500'
                : checked
                ? 'border-portrait-ink'
                : 'border-portrait-ink',
              // Background
              checked ? 'bg-mint-wash' : 'bg-white',
              // Focus ring
              'peer-focus:ring-2 peer-focus:ring-portrait-ink peer-focus:ring-offset-2',
              // Disabled state
              disabled && 'opacity-50 cursor-not-allowed bg-mist-hairline',
              // Hover (when not disabled)
              !disabled && !checked && 'hover:bg-sky-wash'
            )}
          >
            {checked && (
              <Check
                className={cn(
                  'h-3 w-3 text-portrait-ink',
                  disabled && 'text-slate-helper'
                )}
                strokeWidth={3}
              />
            )}
          </label>
        </div>

        {(label || description) && (
          <div className="flex flex-col gap-0.5">
            {label && (
              <label
                htmlFor={id}
                className={cn(
                  'text-sm font-medium cursor-pointer',
                  disabled ? 'text-slate-helper' : 'text-portrait-ink',
                  error && 'text-red-700'
                )}
              >
                {label}
              </label>
            )}

            {description && (
              <p
                id={`${id}-description`}
                className={cn(
                  'text-xs',
                  error ? 'text-red-600' : 'text-slate-helper'
                )}
              >
                {description}
              </p>
            )}

            {error && (
              <p className="text-xs text-red-600 mt-0.5">{error}</p>
            )}
          </div>
        )}
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';
