import { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

/**
 * Input component following Portrait design system
 *
 * Features:
 * - 16px border radius
 * - Portrait Ink border
 * - Optional label and error message
 * - Focus ring for accessibility
 *
 * Usage:
 * <Input label="Email" type="email" placeholder="you@example.com" />
 * <Input label="Name" error="Name is required" />
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className, type = 'text', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block font-switzer font-medium text-sm text-portrait-ink mb-2">
            {label}
          </label>
        )}

        <input
          ref={ref}
          type={type}
          className={cn(
            // Base styles
            'w-full rounded-input px-4 py-2.5',
            'font-switzer text-base text-portrait-ink',
            'bg-white border border-ash',
            'placeholder:text-slate-helper',
            'transition-colors duration-200',

            // Focus styles
            'focus:outline-none focus:ring-2 focus:ring-portrait-ink focus:border-transparent',

            // Error styles
            error && 'border-red-500 focus:ring-red-500',

            // Disabled styles
            'disabled:bg-mist disabled:cursor-not-allowed disabled:opacity-50',

            className
          )}
          {...props}
        />

        {helperText && !error && (
          <p className="mt-1.5 font-switzer text-sm text-slate-helper">
            {helperText}
          </p>
        )}

        {error && (
          <p className="mt-1.5 font-switzer text-sm text-red-600">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
