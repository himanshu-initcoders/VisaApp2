import { HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated';
  children: React.ReactNode;
}

/**
 * Card component following Portrait design system
 *
 * Features:
 * - 24px border radius
 * - White background
 * - Subtle 1px outline
 * - Optional elevated shadow
 *
 * Variants:
 * - default: Standard card with basic shadow
 * - elevated: Card with more pronounced shadow
 *
 * Usage:
 * <Card>Content here</Card>
 * <Card variant="elevated">Elevated content</Card>
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          // Base styles
          'bg-white rounded-card p-4',

          // Variant styles
          variant === 'default' && 'shadow-card',
          variant === 'elevated' && 'shadow-elevated',

          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

/**
 * CardHeader - Top section of card with title
 */
export const CardHeader = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn('flex flex-col space-y-1.5 pb-4', className)}
      {...props}
    />
  );
});

CardHeader.displayName = 'CardHeader';

/**
 * CardTitle - Main title in card header
 */
export const CardTitle = forwardRef<
  HTMLHeadingElement,
  HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => {
  return (
    <h3
      ref={ref}
      className={cn(
        'font-switzer font-semibold text-xl text-portrait-ink leading-none tracking-tight',
        className
      )}
      {...props}
    />
  );
});

CardTitle.displayName = 'CardTitle';

/**
 * CardDescription - Supporting text in card header
 */
export const CardDescription = forwardRef<
  HTMLParagraphElement,
  HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => {
  return (
    <p
      ref={ref}
      className={cn('font-switzer text-sm text-slate-helper', className)}
      {...props}
    />
  );
});

CardDescription.displayName = 'CardDescription';

/**
 * CardContent - Main content area of card
 */
export const CardContent = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  return <div ref={ref} className={cn('', className)} {...props} />;
});

CardContent.displayName = 'CardContent';

/**
 * CardFooter - Bottom section of card with actions
 */
export const CardFooter = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn('flex items-center pt-4', className)}
      {...props}
    />
  );
});

CardFooter.displayName = 'CardFooter';
