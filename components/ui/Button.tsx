import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

/**
 * Button component following Portrait design system
 *
 * Variants:
 * - primary: Rainbow outline button (transparent fill, 1.5px gradient border)
 * - ghost: Text-only button (no background, no border)
 *
 * Sizes:
 * - sm: Small button (12px padding)
 * - md: Medium button (16px padding) - default
 * - lg: Large button (20px padding)
 *
 * Usage:
 * <Button variant="primary">Sign up</Button>
 * <Button variant="ghost">Login</Button>
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = 'primary', size = 'md', className, children, disabled, ...props },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          // Base styles
          'rounded-button font-switzer font-medium transition-all duration-200',
          'focus:outline-none focus:ring-2 focus:ring-portrait-ink focus:ring-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed',

          // Variant styles
          variant === 'primary' &&
            'bg-transparent border-[1.5px] border-portrait-ink text-portrait-ink hover:bg-portrait-ink hover:text-white',
          variant === 'ghost' &&
            'bg-transparent text-portrait-ink hover:opacity-80',

          // Size styles
          size === 'sm' && 'px-3 py-1.5 text-sm',
          size === 'md' && 'px-4 py-2.5 text-base',
          size === 'lg' && 'px-6 py-3 text-lg',

          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
