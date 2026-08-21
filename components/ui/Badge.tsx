import { cn } from '@/lib/utils';

/**
 * Badge Component
 *
 * Professional variant of Portrait design system
 * Used for status indicators, role labels, etc.
 *
 * Design: 9999px radius (pill), 10px Switzer 600, 3px×8px padding
 * Colors: Pastel washes (mint, sky, peach) with Portrait ink text
 */

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | 'default'
    | 'pending'
    | 'review'
    | 'approved'
    | 'rejected'
    | 'admin'
    | 'reviewer'
    | 'user';
  children: React.ReactNode;
}

export function Badge({
  variant = 'default',
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full font-switzer text-[10px] font-semibold uppercase tracking-wider',
        {
          // Status variants
          'bg-mist text-iron': variant === 'default',
          'bg-peach-wash text-portrait-ink': variant === 'pending',
          'bg-sky-wash text-nautical-teal': variant === 'review',
          'bg-mint-wash text-portrait-ink': variant === 'approved',
          'bg-red-100 text-red-800': variant === 'rejected',

          // Role variants
          'bg-nautical-teal text-white': variant === 'admin',
          'bg-sky-wash text-portrait-ink': variant === 'reviewer',
          'bg-mist text-slate-helper': variant === 'user',
        },
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

/**
 * Get Badge variant based on application status
 */
export function getStatusVariant(
  status: string
): BadgeProps['variant'] {
  switch (status) {
    case 'draft':
      return 'default';
    case 'submitted':
    case 'pending':
      return 'pending';
    case 'under_review':
      return 'review';
    case 'approved':
      return 'approved';
    case 'rejected':
      return 'rejected';
    default:
      return 'default';
  }
}

/**
 * Get Badge variant based on user role
 */
export function getRoleVariant(
  role: string
): BadgeProps['variant'] {
  switch (role) {
    case 'admin':
      return 'admin';
    case 'reviewer':
      return 'reviewer';
    case 'user':
      return 'user';
    default:
      return 'user';
  }
}
